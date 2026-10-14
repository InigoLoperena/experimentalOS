import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {sealSecrets} from '../lib/integration-secrets';
import {workspaceConnection,resolvedGoogleAds,resolvedSmartlead,resolvedMetricool,resolvedPosthog} from '../lib/integration-service';
import {workspaceConnectionChoice} from '../lib/workspace-connection';
import {integrationCatalog,type Connection,type IntegrationProvider} from '../lib/integrations';
import type {Item} from '../lib/model';
import {item} from './service-fixture';

test('all provider accounts belong to the workspace, with deterministic legacy selection',()=>{
 for(const entry of Object.values(integrationCatalog))assert.equal(entry.scope,'workspace');
 const row={id:'old',provider:'google_ads',project_id:'p',workspace_default:true} as Connection;
 assert.equal(workspaceConnectionChoice([{...row,id:'local',workspace_default:false},row],'google_ads')?.id,'old');
 assert.equal(workspaceConnectionChoice([{...row,workspace_default:false},{...row,id:'other',workspace_default:false}],'google_ads'),null);
 assert.equal(workspaceConnectionChoice([row],'smartlead'),null);
});

test('Google, Smartlead, Metricool and PostHog reuse the workspace credential without changing its encryption binding or crossing tenants',async()=>{
 const old=process.env.INTEGRATIONS_ENCRYPTION_KEY;process.env.INTEGRATIONS_ENCRYPTION_KEY='a'.repeat(64);
 const configs:Partial<Record<IntegrationProvider,Record<string,string>>>={google_ads:{customer_id:'1234567890',client_id:'client'},smartlead:{},metricool:{user_id:'123',blog_id:'456'},posthog:{host:'https://us.posthog.com',project_id:'100'}};
 const secrets:Partial<Record<IntegrationProvider,Record<string,string>>>={google_ads:{client_secret:'secret',refresh_token:'refresh'},smartlead:{api_key:'private-smart'},metricool:{api_key:'private-metricool'},posthog:{api_key:'private-posthog'}};
 const rows=Object.fromEntries(Object.entries(configs).map(([provider,config])=>[provider,{id:provider,workspace_id:'team',project_id:'original-project',provider,config,source:'encrypted',enabled:true,workspace_default:true,updated_at:'revision',verified_at:null,verification_note:'',secret_fields:Object.keys(secrets[provider as IntegrationProvider]!)}])) as Record<IntegrationProvider,Connection>;
 let disabled=false,profile=false;const reads:string[]=[];
 const client=createClient('https://test.supabase.co','public',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/rpc/read_integration_envelope')){const id=JSON.parse(String(init?.body)).p_id as IntegrationProvider;reads.push(id);return Response.json(sealSecrets(rows[id],secrets[id]!));}
  const provider=url.searchParams.get('provider')!.slice(3) as IntegrationProvider;
  if(url.searchParams.get('workspace_id')!=='eq.team')return Response.json(null);
  if(url.pathname.endsWith('/integration_project_profiles'))return Response.json(profile?{config:provider==='metricool'?{blog_id:'789'}:{project_id:'300',host:'https://eu.posthog.com'},updated_at:'profile-revision'}:null);
  assert.equal(url.searchParams.get('workspace_default'),'eq.true');
  return Response.json({...rows[provider],enabled:!disabled});
 }}});
 const target={...item('other-project','project'),workspace_id:'team',fields:{posthog_project_id:'200',posthog_host:'https://eu.posthog.com'}};
 try{
  assert.equal((await resolvedGoogleAds(client,target)).customerId,'1234567890');
  assert.equal((await resolvedSmartlead(client,target)).key,'private-smart');
  assert.deepEqual(await resolvedMetricool(client,target),{userId:'123',blogId:'456',token:'private-metricool'});
  assert.deepEqual(await resolvedPosthog(client,target),{host:'https://eu.posthog.com',projectId:'200',key:'private-posthog'});
  profile=true;assert.equal((await resolvedMetricool(client,target)).blogId,'789');assert.equal((await resolvedPosthog(client,target)).projectId,'300');
  const before=reads.length;disabled=true;await assert.rejects(resolvedGoogleAds(client,target),/desactivada/);assert.equal(reads.length,before);
  assert.equal(await workspaceConnection(client,'other-team','smartlead'),null);assert.equal(reads.length,before);
 }finally{if(old===undefined)delete process.env.INTEGRATIONS_ENCRYPTION_KEY;else process.env.INTEGRATIONS_ENCRYPTION_KEY=old;}
});

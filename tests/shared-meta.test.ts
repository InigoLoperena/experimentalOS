import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {resolvedMetaConnection} from '../lib/integration-service';
import {sealSecrets} from '../lib/integration-secrets';
import type {Connection} from '../lib/integrations';
import type {Item} from '../lib/model';

test('Meta inherits only explicitly shared same-team credentials, preserves their encrypted binding and respects local disable',async()=>{
 const previous=process.env.INTEGRATIONS_ENCRYPTION_KEY;process.env.INTEGRATIONS_ENCRYPTION_KEY='a'.repeat(64);
 const row:Connection={id:'shared',workspace_id:'team',project_id:'source',provider:'meta_ads',source:'encrypted',config:{account_id:'123'},enabled:true,workspace_default:true,updated_at:'revision',secret_fields:['access_token','write_token'],verified_at:null,verification_note:''};
 const envelope=sealSecrets(row,{access_token:'private',write_token:'write-private'});
 const project={id:'target',workspace_id:'team'} as Item;
 let sharedReads=0,local:Connection|null=null,shared:Connection|null=row;
 const client=createClient('https://test.supabase.co','public-test',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/rpc/read_integration_envelope')){
   assert.equal(JSON.parse(String(init?.body)).p_id,'shared');return Response.json(envelope);
  }
  assert.equal(url.searchParams.get('workspace_id'),`eq.${project.workspace_id}`);
  assert.equal(url.searchParams.get('provider'),'eq.meta_ads');
  if(url.searchParams.has('workspace_default')){sharedReads++;assert.equal(url.searchParams.get('workspace_default'),'eq.true');assert.equal(url.searchParams.get('source'),'eq.encrypted');return Response.json(shared);}
  assert.equal(url.searchParams.get('project_id'),'eq.target');return Response.json(local);
 }}});
 try{
  assert.deepEqual(await resolvedMetaConnection(client,project),{accountId:'123',token:'private',writeToken:'write-private',revision:'revision',pageId:undefined,instagramId:undefined,pixelId:undefined});
  local={...row,project_id:'target',workspace_default:false,enabled:false};
  await assert.rejects(resolvedMetaConnection(client,project),/desactivada/);assert.equal(sharedReads,1);
  local=null;shared=null;
  await assert.rejects(resolvedMetaConnection(client,project),/Configura Meta/);
  project.workspace_id='other';await assert.rejects(resolvedMetaConnection(client,project),/Configura Meta/);
 }finally{if(previous===undefined)delete process.env.INTEGRATIONS_ENCRYPTION_KEY;else process.env.INTEGRATIONS_ENCRYPTION_KEY=previous;}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {posthogRecipe,posthogWrite,posthogFlagKey,verifiedPosthogDraft} from '../lib/posthog-build';
import {parsePosthogOptions} from '../lib/posthog-options';
import {posthogResultVariants} from '../lib/posthog-results';
import {emptyExecution,parseChannel} from '../lib/execution-plan';
import {preparationSchemaForRequest} from '../lib/ai-preparation';
import {POST} from '../app/api/posthog/prepare/route';
import {sealSecrets} from '../lib/integration-secrets';
import type {Connection} from '../lib/integrations';
import {item} from './service-fixture';
const e='44444444-4444-4444-8444-444444444444',p='33333333-3333-4333-8333-333333333333',w='22222222-2222-4222-8222-222222222222',u='55555555-5555-4555-8555-555555555555',j='66666666-6666-4666-8666-666666666666';
const plan={...emptyExecution(),goal:'product' as const,posthog:{metric_event:'signup_completed',metric_type:'funnel' as const,rollout_percentage:20,window_days:7},variants:['A · Control','B · Nuevo mensaje'].map(label=>({label,description:'Texto del botón',headline:'Descubrir',body:'Propuesta para revisar',call_to_action:null,allocation:null}))};
const experiment={...item(e),project_id:p,workspace_id:w,title:'Onboarding',updated_at:'2026-10-14T18:00:00Z',fields:{channel:'posthog',hypothesis:'El mensaje mejora los registros',metric:'Conversión a registro',execution_config:JSON.stringify(plan)}};
const c={host:'https://eu.posthog.com',projectId:'77',key:'private-team-key'};
test('PostHog prepares two inactive variants, real conversion metrics and deterministic identity without scheduling a launch',async()=>{
 const recipe=await posthogRecipe({...experiment,fields:{...experiment.fields,start:'2026-10-15'}},c,(async()=>Response.json({results:[{name:'signup_completed'}]})) as typeof fetch);
 assert.equal(recipe.payload.name,'Experimento · Onboarding');assert.equal(recipe.payload.type,'product');assert.equal(recipe.payload.start_date,null);assert.equal(recipe.payload.end_date,null);
 assert.equal(recipe.payload.feature_flag_key,posthogFlagKey(e));assert.deepEqual(recipe.payload.feature_flag.filters.multivariate.variants.map(v=>[v.key,v.rollout_percentage]),[['control',50],['test',50]]);
 assert.equal(recipe.payload.feature_flag.filters.groups[0].rollout_percentage,20);assert.equal(recipe.payload.metrics?.[0].metric_type,'funnel');assert.deepEqual(recipe.payload.metrics?.[0].series,[{kind:'EventsNode',event:'signup_completed'}]);
 assert.ok(!JSON.stringify(recipe).includes(c.key));assert.equal(parseChannel('posthog'),'posthog');
 const zero=await posthogRecipe({...experiment,fields:{...experiment.fields,execution_config:JSON.stringify({...plan,posthog:{...plan.posthog,rollout_percentage:0}})}},c,(async()=>Response.json({results:[]})) as typeof fetch);
 assert.equal(zero.payload.feature_flag.filters.groups[0].rollout_percentage,0);
 const schema=preparationSchemaForRequest('posthog','Compara el mensaje de bienvenida'),execution=schema.properties.execution.anyOf[0];assert.ok('properties' in execution);assert.ok('minItems' in execution.properties.variants);assert.equal(execution.properties.variants.minItems,2);
 for(const options of [{metric_event:null,metric_type:null,rollout_percentage:120,window_days:7},{metric_event:null,metric_type:'fabricated',rollout_percentage:null,window_days:null}])assert.throws(()=>parsePosthogOptions(options));
});
test('unconfirmed events or read permissions do not block a draft or invent instrumentation',async()=>{
 for(const fetcher of [(async()=>Response.json({results:[{name:'different_event'}]})),(async()=>Response.json({detail:'private-team-key'},{status:403}))]){
  const recipe=await posthogRecipe(experiment,c,fetcher as typeof fetch);assert.equal(recipe.payload.metrics,undefined);assert.ok(recipe.notes.length);assert.ok(!JSON.stringify(recipe).includes(c.key));
 }
 const partial={...plan,variants:plan.variants.map((v,i)=>({...v,allocation:i===0?30:null}))};
 const recipe=await posthogRecipe({...experiment,fields:{...experiment.fields,execution_config:JSON.stringify(partial)}},c,(async()=>Response.json({results:[]})) as typeof fetch);
 assert.deepEqual(recipe.payload.feature_flag.filters.multivariate.variants.map(v=>v.rollout_percentage),[30,70]);
});
test('PostHog write timeouts and unsafe responses never claim a confirmed draft or expose tokens',async()=>{
 await assert.rejects(posthogWrite(c,{},(async()=>{throw new Error('private-team-key');}) as typeof fetch),err=>err instanceof Error&&!err.message.includes(c.key));
 await assert.rejects(posthogWrite(c,{},(async()=>Response.json({detail:c.key},{status:403})) as typeof fetch),/experiment:write/);
 for(const detail of [{id:12,feature_flag_key:'different'}, {id:12,feature_flag_key:posthogFlagKey(e),start_date:null,feature_flag:{id:9,key:posthogFlagKey(e),active:true}}])assert.throws(()=>verifiedPosthogDraft(detail,posthogFlagKey(e)),/borrador/);
 assert.throws(()=>verifiedPosthogDraft({id:12,feature_flag_key:posthogFlagKey(e),start_date:null,feature_flag:{id:9,key:posthogFlagKey(e),active:false,filters:{groups:[{rollout_percentage:100}],multivariate:{variants:[{key:'control',rollout_percentage:50},{key:'test',rollout_percentage:50}]}}}},posthogFlagKey(e),{groups:[{rollout_percentage:20}],multivariate:{variants:[{key:'control',rollout_percentage:60},{key:'test',rollout_percentage:40}]}}),/reparto/);
});
test('cached PostHog metric results retain baseline and exposure counts without fabricating zeros',()=>{
 assert.deepEqual(posthogResultVariants({results:[{result:{baseline:{key:'control',mean:0.2,number_of_samples:120},variants:[{key:'test',conversion_rate:0.3,exposures:110}]}}]}),[{name:'control',value:0.2,exposures:120},{name:'test',value:0.3,exposures:110}]);
 assert.deepEqual(posthogResultVariants({}),[]);assert.equal(posthogResultVariants({variants:[{key:'control'}]})[0].value,undefined);
});
test('another workspace creates and links its own PostHog draft, denies editing and recovers an uncertain POST without duplicating it',async()=>{
 const before={...process.env},original=globalThis.fetch;process.env.NEXT_PUBLIC_SUPABASE_URL='https://tenant.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-unit';process.env.INTEGRATIONS_ENCRYPTION_KEY='a'.repeat(64);
 const project={...item(p,'project'),workspace_id:w,fields:{}};
 const row:Connection={id:'connection',provider:'posthog',workspace_id:w,project_id:null,config:{project_id:'42',host:'https://us.posthog.com'},source:'encrypted',enabled:true,secret_fields:['api_key'],updated_at:'revision',verified_at:null,verification_note:''};
 const envelope=sealSecrets(row,{api_key:c.key});let jobs:any[]=[],linked='',writes=0,editable=true,uncertain=false,remote:any=null;
 globalThis.fetch=async(input,options)=>{
  const url=new URL(String(input)),path=url.pathname,json=(v:unknown)=>Response.json(v),body=()=>JSON.parse(String(options?.body||'{}'));
  if(url.hostname==='eu.posthog.com'){
   assert.ok(path.startsWith('/api/projects/77/'));assert.equal(new Headers(options?.headers).get('Authorization'),`Bearer ${c.key}`);
   if(path.includes('event_definitions'))return json({results:[{name:'signup_completed'}]});
   if(options?.method==='POST'){
    writes++;const sent=body();assert.equal(sent.start_date,null);assert.equal(sent.end_date,null);assert.equal(sent.name,'Experimento · Onboarding');assert.equal(sent.feature_flag.filters.multivariate.variants.length,2);
    remote={...sent,id:123,status:'draft',feature_flag:{id:55,key:sent.feature_flag_key,active:false,filters:sent.feature_flag.filters}};
    if(uncertain)throw new Error('connection interrupted');return json(remote);
   }
   if(path.endsWith('/123/'))return json(remote);
   return json({results:remote?[remote]:[],next:null});
  }
  assert.equal(url.hostname,'tenant.supabase.co');
  if(path==='/auth/v1/user')return json({id:u,aud:'authenticated',role:'authenticated'});
  if(path.endsWith('/records'))return json(url.searchParams.get('kind')==='eq.project'?project:{...experiment,fields:{...experiment.fields,...(linked?{posthog_experiment_id:linked}:{})}});
  if(path.endsWith('/rpc/can_record_action'))return json(editable);
  if(path.endsWith('/integration_connections')){assert.equal(url.searchParams.get('workspace_id'),`eq.${w}`);return json(row);}
  if(path.endsWith('/integration_project_profiles')){assert.equal(url.searchParams.get('project_id'),`eq.${p}`);return json({config:{host:c.host,project_id:c.projectId}});}
  if(path.endsWith('/rpc/read_integration_envelope'))return json(envelope);
  if(path.endsWith('/posthog_preparations')){for(const [key,id] of [['workspace_id',w],['project_id',p],['experiment_id',e]])assert.equal(url.searchParams.get(key),`eq.${id}`);return json(jobs);}
  if(path.endsWith('/rpc/reserve_posthog')){const b=body();assert.equal(b.p_host,c.host);assert.equal(b.p_project,c.projectId);assert.equal(b.p_revision,experiment.updated_at);jobs=[{id:j,status:'pending',host:c.host,external_project_id:c.projectId,flag_key:posthogFlagKey(e),created_by:u}];return json(j);}
  if(path.endsWith('/rpc/finish_posthog')){const b=body();jobs[0].status=b.p_status;if(b.p_external){linked=b.p_external;jobs[0].external_id=linked;}return json(null);}
  throw new Error(`Unexpected request ${path}`);
 };
 const call=(body:Record<string,unknown>)=>POST(new Request('https://app.test/api/posthog/prepare',{method:'POST',headers:{Authorization:'Bearer tenant-session','Content-Type':'application/json'},body:JSON.stringify({project_id:p,experiment_id:e,...body})}));
 try{
  const review=await call({action:'review'}),r=await review.json();assert.equal(review.status,200);assert.equal(writes,0);
  const stale=await call({action:'create',fingerprint:'old',confirmed:true,request_id:j});assert.equal(stale.status,409);assert.equal(writes,0);
  editable=false;const denied=await call({action:'create',fingerprint:r.fingerprint,confirmed:true,request_id:j});assert.equal(denied.status,403);assert.equal(writes,0);editable=true;
  const created=await call({action:'create',fingerprint:r.fingerprint,confirmed:true,request_id:j});assert.equal(created.status,200);const saved=await created.json();assert.equal(saved.id,'123');assert.equal(saved.status,'Borrador');assert.equal(saved.record.fields.posthog_experiment_id,'123');assert.equal(writes,1);
  assert.equal((await call({action:'create',fingerprint:r.fingerprint,confirmed:true,request_id:j})).status,409);assert.equal(writes,1);
  jobs=[];linked='';remote=null;uncertain=true;
  const interrupted=await call({action:'create',fingerprint:r.fingerprint,confirmed:true,request_id:j});assert.equal(interrupted.status,502);assert.equal(jobs[0].status,'uncertain');assert.equal(writes,2);
  const recovered=await call({action:'status',refresh:true});assert.equal(recovered.status,200);assert.equal((await recovered.json()).id,'123');assert.equal(linked,'123');assert.equal(writes,2);
 }finally{globalThis.fetch=original;process.env=before;}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {POST as integrations} from '../app/api/integrations/route';
import {POST as meta} from '../app/api/meta/route';
import {POST as build} from '../app/api/meta/build/route';
import {emptyExecution} from '../lib/execution-plan';
import {emptyMeta} from '../lib/meta-options';
import {automaticMetaSelection} from '../lib/meta-auto-selection';
import type {Connection} from '../lib/integrations';
import type {Attachment} from '../lib/attachments';

test('a different team owner saves private Meta credentials, reads campaigns and builds paused A/B ads without pilot credentials',async()=>{
 const env={...process.env},originalFetch=globalThis.fetch;
 const w='22222222-2222-4222-8222-222222222222',p='33333333-3333-4333-8333-333333333333',e='44444444-4444-4444-8444-444444444444',u='55555555-5555-4555-8555-555555555555',runId='66666666-6666-4666-8666-666666666666';
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://customer.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-unit';process.env.INTEGRATIONS_ENCRYPTION_KEY='a'.repeat(64);
 process.env.META_ADS_WORKSPACE_ID='pilot-only';process.env.META_ADS_PROJECT_ID='pilot-only';process.env.META_ADS_ACCESS_TOKEN='pilot-read';process.env.META_ADS_WRITE_ACCESS_TOKEN='pilot-write';
 const config={account_id:'999999',app_id:'888888',page_id:'777777',instagram_id:'666666'};
 const plan={...emptyExecution(),meta:{...emptyMeta(),objective:'traffic' as const,countries:['ES'],age_min:25,age_max:55,placements:['feed','story','reels'] as ('feed'|'story'|'reels')[]},goal:'traffic' as const,destination:'https://example.org/',daily_budget:10,currency:'USD',duration_days:7,variants:['A','B'].map(label=>({label,description:null,headline:`Headline ${label}`,body:`Copy ${label}`,call_to_action:'LEARN_MORE',allocation:null,media_names:[`${label}.png`]}))};
 const project={id:p,kind:'project',workspace_id:w,title:'Customer project',fields:{}};
 const experiment={id:e,workspace_id:w,project_id:p,kind:'experiment',title:'Customer test',updated_at:'2026-10-01T00:00:00.000Z',fields:{channel:'meta_ads',execution_config:JSON.stringify(plan)}};
 const image=await sharp({create:{width:1440,height:2560,channels:3,background:'#b6fc46'}}).png().toBuffer();
 const attachments=['A','B'].map((label,i)=>({id:`${i+7}7777777-7777-4777-8777-777777777777`,workspace_id:w,record_id:e,name:`${label}.png`,kind:'image',mime_type:'image/png',size:image.length,storage_path:`${w}/${e}/${label}.png`})) as Attachment[];
 const variants=['A','B'].map((label,i)=>({id:`v${i}`,label,workspace_id:w,project_id:p,experiment_id:e}));
 let row:Connection|null=null,envelope='',role='owner',canEdit=true;
 let run:Record<string,unknown>|null=null,graphWrites=0,rejectedOnce=false;
 const receipts:{step_key:string;status:string;result:unknown}[]=[];
 const reservations=new Map<string,string>(),resources:Record<string,unknown>[]=[];
 globalThis.fetch=async(input,options)=>{
  const url=new URL(String(input)),path=url.pathname,json=(data:unknown)=>Response.json(data);
  const body=()=>JSON.parse(String(options?.body||'{}'));
  if(url.hostname==='graph.facebook.com'){
   const token=new Headers(options?.headers).get('Authorization');
   assert.ok(token==='Bearer customer-read'||token==='Bearer customer-write');assert.ok(path.startsWith('/v26.0/act_999999'));
   if(options?.method==='POST'){
    assert.equal(token,'Bearer customer-write');graphWrites++;
    const payload=options.body as URLSearchParams;
    if(path.endsWith('/adimages')){
     const bytes=Buffer.from(payload.get('bytes')!,'base64');const info=await sharp(bytes).metadata();assert.equal(info.format,'jpeg');
     return json({images:{file:{hash:'a'.repeat(32)}}});
    }
    if(!path.endsWith('/adcreatives'))assert.equal(payload.get('status'),'PAUSED');
    if(path.endsWith('/adsets')){
     const targeting=JSON.parse(payload.get('targeting')!);
     assert.deepEqual(targeting.targeting_automation,{advantage_audience:0});assert.equal(targeting.age_min,25);assert.equal(targeting.age_max,55);
     if(!rejectedOnce){rejectedOnce=true;return Response.json({error:{code:100,error_subcode:999,error_user_title:'Parámetro requerido',error_user_msg:'Revisa este parámetro en Meta.'}},{status:400});}
    }
    if(path.endsWith('/campaigns'))assert.equal(payload.get('name'),'Experimento · Customer test');
    if(path.endsWith('/adcreatives')){
     const creative=JSON.parse(payload.get('object_story_spec')!);assert.equal(creative.page_id,config.page_id);assert.equal(creative.instagram_user_id,config.instagram_id);assert.equal(creative.link_data.image_hash,'a'.repeat(32));
    }
    return json({id:String(900000+graphWrites)});
   }
   if(path.endsWith('/campaigns'))return json({data:[{id:'900001',account_id:config.account_id,name:'Customer campaign',effective_status:'PAUSED'}]});
   return json({account_id:config.account_id,name:'Customer account',currency:'USD',timezone_name:'America/New_York',account_status:1});
  }
  assert.equal(url.hostname,'customer.supabase.co');
  if(path==='/auth/v1/user')return json({id:u,role:'authenticated',aud:'authenticated',email:'owner@customer.example'});
  if(path.endsWith('/members'))return json({role});
  if(path.endsWith('/records'))return json(url.searchParams.get('id')===`eq.${p}`?project:experiment);
  if(path.endsWith('/integration_connections')){assert.equal(url.searchParams.get('workspace_id'),`eq.${w}`);if(url.searchParams.has('workspace_default')||url.searchParams.get('project_id')==='is.null')return json(null);assert.equal(url.searchParams.get('project_id'),`eq.${p}`);return json(row);}
  if(path.endsWith('/integration_project_profiles'))return json(null);
  if(path.endsWith('/rpc/save_integration')){
   const saved=body();assert.equal(saved.p_workspace,w);assert.equal(saved.p_project,p);assert.deepEqual(saved.p_config,config);
   envelope=saved.p_envelope;assert.ok(!envelope.includes('customer-read'));
   row={id:'connection',workspace_id:w,project_id:p,provider:'meta_ads',config,source:'encrypted',secret_fields:saved.p_fields,enabled:true,verified_at:null,verification_note:'',updated_at:'revision'};return json(row);
  }
  if(path.endsWith('/rpc/read_integration_envelope')){assert.equal(body().p_id,'connection');return json(envelope);}
  if(path.endsWith('/rpc/set_integration_state')){assert.equal(body().p_id,'connection');return json(null);}
  if(path.endsWith('/rpc/can_record_action'))return json(canEdit);
  if(path.endsWith('/record_attachments')){assert.equal(url.searchParams.get('workspace_id'),`eq.${w}`);assert.equal(url.searchParams.get('record_id'),`eq.${e}`);return json(attachments);}
  if(path.startsWith('/storage/v1/object/')){assert.ok(path.includes(`${w}/${e}/`));return new Response(new Uint8Array(image),{headers:{'Content-Type':'image/png'}});}
  if(path.endsWith('/experiment_specs'))return json({code:'EXP-CUSTOMER-0001'});
  if(path.endsWith('/experiment_variants'))return json(variants);
  if(path.endsWith('/meta_preparation_runs'))return json(run);
  if(path.endsWith('/meta_preparation_steps'))return json(receipts);
  if(path.endsWith('/rpc/begin_meta_run')){const saved=body();assert.equal(saved.p_experiment,e);run={id:runId,selection:saved.p_selection,fingerprint:saved.p_fingerprint};return json(runId);}
  if(path.endsWith('/rpc/reserve_meta_step')){const saved=body();assert.equal(saved.p_run,runId);reservations.set(saved.p_request,saved.p_step);return json(null);}
  if(path.endsWith('/rpc/finish_meta_step')){const saved=body();assert.ok(Object.keys(saved.p_result).every(key=>['id','hash'].includes(key)));const key=reservations.get(saved.p_request)!;const previous=receipts.findIndex(r=>r.step_key===key);if(previous>=0)receipts.splice(previous,1);receipts.push({step_key:key,status:saved.p_status,result:saved.p_result});if(saved.p_type)resources.push({type:saved.p_type,id:saved.p_result.id});return json(null);}
  throw new Error(`Unexpected test request: ${path}`);
 };
 const request=(handler:(request:Request)=>Promise<Response>,body:unknown)=>handler(new Request('https://app.test/api',{method:'POST',headers:{Authorization:'Bearer customer-session','Content-Type':'application/json'},body:JSON.stringify(body)}));
 try{
  const saved=await request(integrations,{action:'save',workspace_id:w,project_id:p,provider:'meta_ads',config,secrets:{access_token:'customer-read',write_token:'customer-write'},expected:null});assert.equal(saved.status,200);assert.ok(!JSON.stringify(await saved.json()).includes('customer-read'));
  const checked=await request(integrations,{action:'verify',workspace_id:w,project_id:p,provider:'meta_ads',expected:'revision'});assert.equal(checked.status,200);assert.match((await checked.json()).note,/Customer account/);
  const campaigns=await request(meta,{project_id:p});assert.equal(campaigns.status,200);assert.equal((await campaigns.json()).account.id,config.account_id);
  const selection=automaticMetaSelection(plan,attachments,undefined);
  const reviewed=await request(build,{action:'review',project_id:p,experiment_id:e,selection});assert.equal(reviewed.status,200);const review=await reviewed.json();assert.equal(review.name,'Experimento · Customer test');assert.equal(review.previews.length,6);assert.equal(review.write_available,true);assert.equal(graphWrites,0);
  const begun=await request(build,{action:'begin',project_id:p,experiment_id:e,selection:review.selection,fingerprint:review.fingerprint,confirmed:true,request_id:runId});assert.equal(begun.status,200);
  for(let i=0;i<25;i++){
   if(i===2){const failed=await request(build,{action:'step',project_id:p,experiment_id:e,run_id:runId});assert.equal(failed.status,502);const cause=await failed.json();assert.equal(cause.meta_error.subcode,999);assert.match(cause.error,/Revisa este parámetro/);assert.equal(receipts.find(r=>r.step_key==='v0_feed_adset')?.status,'rejected');assert.deepEqual(receipts.find(r=>r.step_key==='v0_feed_adset')?.result,{});assert.equal(resources.filter(r=>r.type==='campaign').length,1);}
   const stepped=await request(build,{action:'step',project_id:p,experiment_id:e,run_id:runId});assert.equal(stepped.status,200);assert.equal((await stepped.json()).done,false);
  }
  const finished=await request(build,{action:'step',project_id:p,experiment_id:e,run_id:runId});assert.equal((await finished.json()).done,true);assert.equal(graphWrites,26);assert.equal(resources.filter(r=>r.type==='campaign').length,1);assert.equal(resources.filter(r=>r.type==='ad').length,6);
  role='editor';const forbidden=await request(integrations,{action:'save',workspace_id:w,project_id:p,provider:'meta_ads',config,secrets:{}});assert.equal(forbidden.status,403);assert.equal(graphWrites,26);
  canEdit=false;const denied=await request(build,{action:'review',project_id:p,experiment_id:e,selection});assert.equal(denied.status,403);assert.equal(graphWrites,26);
 }finally{globalThis.fetch=originalFetch;process.env=env;}
});

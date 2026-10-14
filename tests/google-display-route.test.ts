import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {POST as prepare} from '../app/api/google-ads/prepare/route';
import {POST as integrations} from '../app/api/integrations/route';
import {POST as reports} from '../app/api/google-ads/route';
import {emptyExecution} from '../lib/execution-plan';
import {emptyGoogleAds,parseGoogleAdsOptions} from '../lib/google-ads-options';
import {preparationSchemaForRequest} from '../lib/ai-preparation';
import type {Connection} from '../lib/integrations';

for(const type of ['SEARCH','DISPLAY'] as const)test(`another team owner configures Google OAuth and creates ${type} paused resources with private assets and automatic IDs`,async()=>{
 const env={...process.env},original=globalThis.fetch;
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://customer.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-unit';process.env.INTEGRATIONS_ENCRYPTION_KEY='a'.repeat(64);
 const p='33333333-3333-4333-8333-333333333333',w='22222222-2222-4222-8222-222222222222',e='44444444-4444-4444-8444-444444444444',u='55555555-5555-4555-8555-555555555555',requestId='66666666-6666-4666-8666-666666666666';
 const config={customer_id:'9999999999',client_id:'customer-client',login_customer_id:'8888888888'},secrets={client_secret:'customer-secret',refresh_token:'customer-refresh',developer_token:'customer-developer'};
 const source=await sharp({create:{width:1600,height:900,channels:3,background:'#66aa11'}}).png().toBuffer();
 const changedSource=await sharp(source).negate().png().toBuffer();
 const attachments=['A','B'].map((label,i)=>({id:`${i+7}7777777-7777-4777-8777-777777777777`,record_id:e,workspace_id:w,name:`${label}.png`,kind:'image',mime_type:'image/png',size:source.length,storage_path:`${w}/${e}/${label}.png`}));
 const plan={...emptyExecution(),destination:'https://example.org/',daily_budget:10,currency:null,duration_days:7,google:{...emptyGoogleAds(),type,countries:['US'],language_ids:['1000'],keywords:type==='SEARCH'?['free furniture']:[],cpc_limit:1,eu_political:false,business_name:type==='DISPLAY'?'Customer Brand':null,long_headlines:type==='DISPLAY'?['Find free furniture near you','Give a useful item a new life']:[]},variants:['A','B'].map(label=>({label,headline:type==='DISPLAY'?`Free Furniture ${label}`:`Free Furniture ${label}\nFind Local Treasures\nTry Us Today`,body:type==='DISPLAY'?'Find useful furniture in your community.':'Find furniture near you.\nGive useful things a new life.',description:null,call_to_action:null,allocation:null,media_names:[`${label}.png`]}))};
 const project={id:p,workspace_id:w,kind:'project',title:'Customer project',fields:{}},experiment={id:e,workspace_id:w,project_id:p,kind:'experiment',title:'Customer experiment',updated_at:'revision',fields:{channel:'google_ads',execution_config:JSON.stringify(plan)}};
 const variants=['A','B'].map((label,i)=>({id:`variant${i}`,label}));
 let row:Connection|null=null,envelope='',mutations=0,validations=0,role='owner',allowEdit=true,changed=false;
 let savedResources:Record<string,any>[]=[];
 globalThis.fetch=async(input,options)=>{
  const url=new URL(String(input)),path=url.pathname,json=(value:unknown)=>Response.json(value),body=()=>JSON.parse(String(options?.body||'{}'));
  if(url.hostname==='oauth2.googleapis.com'){const params=new URLSearchParams(String(options?.body));assert.equal(params.get('client_id'),config.client_id);assert.equal(params.get('client_secret'),secrets.client_secret);assert.equal(params.get('refresh_token'),secrets.refresh_token);return json({access_token:'customer-access',token_type:'Bearer'});}
  if(url.hostname==='googleads.googleapis.com'){
   assert.ok(path.startsWith(`/v25/customers/${config.customer_id}/`));const headers=new Headers(options?.headers);assert.equal(headers.get('Authorization'),'Bearer customer-access');assert.equal(headers.get('developer-token'),secrets.developer_token);assert.equal(headers.get('login-customer-id'),config.login_customer_id);
   if(path.endsWith('googleAds:search')){const query=body().query;
    if(query.includes('FROM customer'))return json({results:[{customer:{id:config.customer_id,descriptiveName:'Customer account',currencyCode:'USD',timeZone:'UTC',manager:false}}]});
    if(query.includes('FROM geo_target_constant'))return json({results:[{geoTargetConstant:{id:'2840',countryCode:'US'}}]});
    if(query.includes('FROM language_constant'))return json({results:[{languageConstant:{id:'1000',name:'English'}}]});
    throw new Error(`Unexpected Google query: ${query}`);
   }
   const batch=body();assert.equal(batch.partialFailure,false);
   const operations=batch.mutateOperations;const campaign=operations[1].campaignOperation.create;assert.equal(campaign.advertisingChannelType,type);assert.equal(campaign.status,'PAUSED');assert.equal(campaign.name,'Experimento · Customer experiment');assert.equal(operations[2].adGroupOperation.create.status,'PAUSED');
   const ads=operations.filter((op:any)=>op.adGroupAdOperation);assert.equal(ads.length,2);for(const ad of ads)assert.equal(ad.adGroupAdOperation.create.status,'PAUSED');
   const assets=operations.filter((op:any)=>op.assetOperation);assert.equal(assets.length,type==='DISPLAY'?2:0); // identical originals share the same two image assets
   if(type==='DISPLAY'){
    assert.deepEqual(campaign.manualCpc,{});assert.equal(campaign.targetSpend,undefined);assert.equal(operations.some((op:any)=>op.adGroupCriterionOperation),false);
    for(const op of assets){const bytes=Buffer.from(op.assetOperation.create.imageAsset.data,'base64'),meta=await sharp(bytes).metadata();assert.equal(meta.width,1200);assert.ok(meta.height===628||meta.height===1200);assert.equal(meta.format,'jpeg');}
    for(const op of ads){const ad=op.adGroupAdOperation.create.ad;assert.equal(ad.responsiveSearchAd,undefined);assert.equal(ad.responsiveDisplayAd.businessName,'Customer Brand');assert.equal(ad.responsiveDisplayAd.marketingImages.length,1);assert.equal(ad.responsiveDisplayAd.squareMarketingImages.length,1);assert.deepEqual(ad.responsiveDisplayAd.controlSpec,{enableAssetEnhancements:false,enableAutogenVideo:false});}
   }
   if(batch.validateOnly){validations++;return json({});}
   mutations++;return json({mutateOperationResponses:operations.map((op:any,i:number)=>op.campaignBudgetOperation?{campaignBudgetResult:{resourceName:`customers/${config.customer_id}/campaignBudgets/100`}}:op.campaignOperation?{campaignResult:{resourceName:`customers/${config.customer_id}/campaigns/101`}}:op.adGroupOperation?{adGroupResult:{resourceName:`customers/${config.customer_id}/adGroups/102`}}:op.assetOperation?{assetResult:{resourceName:`customers/${config.customer_id}/assets/${103+i}`}}:op.adGroupAdOperation?{adGroupAdResult:{resourceName:`customers/${config.customer_id}/adGroupAds/102~${103+i}`}}:{campaignCriterionResult:{resourceName:`customers/${config.customer_id}/campaignCriteria/101~${i}`}})});
  }
  assert.equal(url.hostname,'customer.supabase.co');
  if(path==='/auth/v1/user')return json({id:u,role:'authenticated',aud:'authenticated',email:'owner@customer.example'});
  if(path.endsWith('/members'))return json({role});
  if(path.endsWith('/records'))return json(url.searchParams.get('kind')==='eq.project'?project:experiment);
  if(path.endsWith('/integration_connections')){assert.equal(url.searchParams.get('workspace_id'),`eq.${w}`);assert.equal(url.searchParams.get('project_id'),`eq.${p}`);return json(row);}
  if(path.endsWith('/rpc/save_integration')){const b=body();assert.equal(b.p_workspace,w);assert.equal(b.p_project,p);envelope=b.p_envelope;assert.ok(!envelope.includes(secrets.client_secret));row={id:'google-connection',workspace_id:w,project_id:p,provider:'google_ads',config,source:'encrypted',secret_fields:b.p_fields,enabled:true,verified_at:null,verification_note:'',updated_at:'revision'};return json(row);}
  if(path.endsWith('/rpc/read_integration_envelope'))return json(envelope);
  if(path.endsWith('/rpc/set_integration_state'))return json(null);
  if(path.endsWith('/rpc/can_record_action'))return json(allowEdit);
  if(path.endsWith('/experiment_specs'))return json({code:'EXP-CUSTOMER-0001'});
  if(path.endsWith('/experiment_variants'))return json(variants);
  if(path.endsWith('/record_attachments')){assert.equal(url.searchParams.get('workspace_id'),`eq.${w}`);assert.equal(url.searchParams.get('record_id'),`eq.${e}`);return json(attachments);}
  if(path.startsWith('/storage/v1/object/')){assert.ok(path.includes(`${w}/${e}/`));return new Response(new Uint8Array(changed?changedSource:source),{headers:{'Content-Type':'image/png'}});}
  if(path.endsWith('/rpc/reserve_google_ads')){const b=body();assert.equal(b.p_experiment,e);assert.equal(b.p_account,config.customer_id);return json(b.p_id);}
  if(path.endsWith('/rpc/finish_google_ads')){const b=body();assert.equal(b.p_status,'succeeded');savedResources=b.p_resources;return json(null);}
  throw new Error(`Unexpected request: ${path}`);
 };
 const request=(handler:(request:Request)=>Promise<Response>,body:unknown)=>handler(new Request('https://app.test/api',{method:'POST',headers:{Authorization:'Bearer customer-session','Content-Type':'application/json'},body:JSON.stringify(body)}));
 try{
  const saved=await request(integrations,{action:'save',workspace_id:w,project_id:p,provider:'google_ads',config,secrets});assert.equal(saved.status,200);
  const checked=await request(integrations,{action:'verify',workspace_id:w,project_id:p,provider:'google_ads',expected:'revision'});assert.equal(checked.status,200);
  const review=await request(prepare,{action:'review',project_id:p,experiment_id:e});assert.equal(review.status,200);const proposal=await review.json();assert.equal(proposal.recipe.type,type);assert.equal(proposal.previews.length,type==='DISPLAY'?4:0);assert.ok(!JSON.stringify(proposal).includes('customer-secret'));assert.equal(mutations,0);
  const invalid=await request(prepare,{action:'create',project_id:p,experiment_id:e,fingerprint:'forged',confirmed:true,request_id:requestId});assert.equal(invalid.status,409);assert.equal(mutations,0);
  if(type==='DISPLAY'){
   changed=true;attachments.forEach(a=>a.size=changedSource.length);
   const stale=await request(prepare,{action:'create',project_id:p,experiment_id:e,fingerprint:proposal.fingerprint,confirmed:true,request_id:requestId});assert.equal(stale.status,409);assert.equal(mutations,0);
   changed=false;attachments.forEach(a=>a.size=source.length);
  }
  const created=await request(prepare,{action:'create',project_id:p,experiment_id:e,fingerprint:proposal.fingerprint,confirmed:true,request_id:requestId});assert.equal(created.status,200);assert.equal(mutations,1);assert.equal(savedResources.length,4);assert.equal(savedResources[2].variant,variants[0].id);assert.equal(savedResources[3].variant,variants[1].id);if(type==='DISPLAY')assert.equal(savedResources[2].images.length,2);
  role='editor';const denied=await request(integrations,{action:'save',workspace_id:w,project_id:p,provider:'google_ads',config,secrets});assert.equal(denied.status,403);
  allowEdit=false;const blocked=await request(prepare,{action:'create',project_id:p,experiment_id:e});assert.equal(blocked.status,403);assert.equal(mutations,1);assert.ok(validations>=3);
 }finally{globalThis.fetch=original;process.env=env;}
});

test('a Display prompt constrains the AI schema to Display instead of silently creating Search',()=>{
 const schema=preparationSchemaForRequest('google_ads','Crea una campaña de display A/B con dos imágenes');
 const execution=schema.properties.execution.anyOf[0];assert.ok('properties' in execution);
 const google=execution.properties.google.anyOf[0];assert.ok('properties' in google);
 assert.deepEqual(google.properties.type.enum,['DISPLAY']);
});
test('an image-only Display comparison can keep identical long headlines across variants',()=>{
 const options=parseGoogleAdsOptions({...emptyGoogleAds(),type:'DISPLAY',business_name:'Brand',long_headlines:['Same message','Same message']});
 assert.deepEqual(options?.long_headlines,['Same message','Same message']);
});

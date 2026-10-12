import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {buildMetaRecipe,parseMetaSelection,metaStepPayload,nextMetaStep,type MetaSelection} from '../lib/meta-build';
import {emptyExecution} from '../lib/execution-plan';
import {emptyMeta} from '../lib/meta-options';
import {renderMetaImage,privateMetaFile} from '../lib/meta-media';
import {writeMetaStep,metaVideoReady} from '../lib/meta-write';
import {MetaCreationError} from '../lib/meta-preparation';
import {metaMetrics,metaIdentity} from '../lib/meta-ads';
import {item} from './service-fixture';
import type {Attachment} from '../lib/attachments';
import type {Variant} from '../lib/monitoring';
const id='11111111-1111-4111-8111-111111111111';
const exp={...item(id),fields:{channel:'meta_ads',execution_config:JSON.stringify({...emptyExecution(),goal:'traffic',destination:'https://example.org/register',daily_budget:10,currency:'USD',duration_days:7,variants:[{label:'A',description:'Control',headline:'Muebles gratuitos',body:'Descubre muebles',call_to_action:'SIGN_UP',allocation:50},{label:'B',description:'Prueba',headline:'Reutiliza',body:'Cuida tu ciudad',call_to_action:'LEARN_MORE',allocation:50}]})}};
const attachments=[{id,record_id:id,workspace_id:'w',kind:'image',storage_path:`w/${id}/${id}.jpg`,size:100,mime_type:'image/jpeg',name:'foto.jpg',url:null}] as Attachment[];
const variants=[{id:'a',label:'A'},{id:'b',label:'B'}] as Variant[];
const selection:MetaSelection={mode:'campaign',parent_id:null,start_at:'2030-01-01T12:00:00.000Z',category:'NONE',meta:{...emptyMeta(),objective:'traffic',countries:['US'],age_min:18,age_max:65,placements:['feed','story','reels']},assignments:['A','B'].flatMap(variant=>(['feed','story','reels'] as const).map(placement=>({variant,placement,attachment_id:id,thumbnail_id:null,crop:'centre' as const})))};
const connection={accountId:'123',token:'private-test',pageId:'456',instagramId:'789',revision:'v1'};
const build=(s=selection)=>buildMetaRecipe(exp,'EXP-GREENHUNT-0042',s,attachments,variants,connection,0);

test('asset discovery preserves accessible advertising identities when page permission is missing, but rejects expired credentials',async()=>{
 const fetcher=(async(url:URL|string)=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/act_123'))return Response.json({account_id:'123',name:'Cuenta',currency:'USD',timezone_name:'Europe/Madrid',account_status:1});
  if(path.endsWith('/456'))return Response.json({error:{code:100}},{status:400});
  if(path.endsWith('/instagram_accounts'))return Response.json({data:[{id:'789',username:'greenhunt'}]});
  return Response.json({data:[{id:'321',name:'Píxel'}]});
 }) as typeof fetch;
 const result=await metaIdentity(connection,fetcher);
 assert.equal(result.page.verified,false);assert.equal(result.instagram?.id,'789');assert.equal(result.pixels[0].id,'321');assert.equal(result.warnings.length,1);
 let calls=0;
 await assert.rejects(metaIdentity(connection,(async()=>{calls++;return Response.json({error:{code:190}},{status:400});}) as typeof fetch),/caducado/);
 assert.equal(calls,1);
});
test('full paused recipe splits the total once, preserves variants and produces explicit placement payloads',()=>{
 const recipe=build();assert.equal(recipe.total,7000);assert.equal(recipe.steps.length,25);
 assert.equal(recipe.steps.filter(s=>s.kind==='adset').reduce((sum,s)=>sum+s.budget!,0),7000);
 const results=Object.fromEntries(recipe.steps.map(s=>[s.key,{id:'987',hash:'a'.repeat(32)}]));
 for(const step of recipe.steps){if(['image','video','thumbnail'].includes(step.kind))continue;const p=metaStepPayload(recipe,step,results) as Record<string,unknown>;if(['campaign','adset','ad'].includes(step.kind))assert.equal(p.status,'PAUSED');if(step.kind==='adset'){assert.equal(p.daily_budget,undefined);assert.equal(p.campaign_id,'987');assert.equal((p.targeting as {publisher_platforms:string[]}).publisher_platforms.length,2);assert.ok(step.variant_id);}}
 const creative=metaStepPayload(recipe,recipe.steps.find(s=>s.kind==='creative')!,results);assert.equal(creative.object_story_spec?.instagram_user_id,'789');assert.equal((creative.object_story_spec as {link_data:{image_hash:string}}).link_data.image_hash,'a'.repeat(32));
});
test('missing prerequisites and invented files, unsupported CTAs, special categories and duplicate media cannot reach Meta',()=>{
 assert.throws(()=>parseMetaSelection({...selection,category:null}));assert.throws(()=>parseMetaSelection({...selection,assignments:[{...selection.assignments[0],attachment_id:'https://internal'}]}));
 assert.throws(()=>build({...selection,meta:{...selection.meta,age_min:null}}));assert.throws(()=>build({...selection,assignments:selection.assignments.slice(1)}));
 assert.throws(()=>build({...selection,assignments:[...selection.assignments.slice(1),selection.assignments[1]]}));
 assert.throws(()=>build({...selection,meta:{...selection.meta,objective:'leads',conversion_event:'LEAD'}}));
 assert.throws(()=>buildMetaRecipe(exp,'EXP-GREENHUNT-0042',selection,[],variants,connection,0));
 assert.throws(()=>buildMetaRecipe(exp,'EXP-GREENHUNT-0042',selection,attachments,variants,{...connection,instagramId:''},0));
});
test('completed, rejected and ambiguous steps resume without repeating confirmed writes',()=>{
 const recipe=build();assert.equal(nextMetaStep(recipe,[]).step?.key,'campaign');
 const first={step_key:'campaign',status:'succeeded',result:{id:'987'}};
 assert.equal(nextMetaStep(recipe,[first]).step?.key,'v0_feed_media');
 assert.equal(nextMetaStep(recipe,[{...first,status:'uncertain'}]).blocked,true);
 assert.equal(nextMetaStep(recipe,[{...first,status:'pending'}]).blocked,true);
 assert.equal(nextMetaStep(recipe,[{...first,status:'rejected'}]).blocked,false);
 assert.equal(nextMetaStep(recipe,recipe.steps.map(s=>({step_key:s.key,status:'succeeded',result:{id:'987'}}))).step,undefined);
});
test('image previews and upload use the same deterministic crop while preserving private source',async()=>{
 const source=await sharp({create:{width:1800,height:900,channels:3,background:'#557744'}}).png().toBuffer();
 const step=build().steps.find(s=>s.kind==='image')!;
 const rendered=await renderMetaImage(source,step),again=await renderMetaImage(source,step);assert.equal(rendered.hash,again.hash);
 const metadata=await sharp(rendered.bytes).metadata();assert.equal(metadata.width,1440);assert.equal(metadata.height,1800);assert.equal(metadata.format,'jpeg');assert.equal(rendered.upscaled,true);
 await assert.rejects(()=>renderMetaImage(Buffer.from('<svg/>'),step));
 let downloads=0;const client={storage:{from:()=>({download:async()=>{downloads++;return {data:new Blob([source]),error:null};}})}};
 await assert.rejects(()=>privateMetaFile(client as never,{...attachments[0],storage_path:'other/private.jpg'}));assert.equal(downloads,0);
});
test('write pipeline sends bounded private media then paused resources; timeout never retries or leaks credentials',async()=>{
 const recipe=build();let calls=0;const results:Record<string,{id?:string;hash?:string}>={};
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{calls++;assert.ok(String(input).startsWith('https://graph.facebook.com/v26.0/act_123/'));assert.equal(init?.redirect,'error');const body=init?.body as URLSearchParams;assert.equal(body.get('access_token'),null);if(String(input).endsWith('/adimages'))return Response.json({images:{image:{hash:'a'.repeat(32)}}});if(!String(input).endsWith('/adcreatives'))assert.equal(body.get('status'),'PAUSED');return Response.json({id:String(1000+calls)});}) as typeof fetch;
 for(const step of recipe.steps)results[step.key]=await writeMetaStep(connection,recipe,step,results,step.kind==='image'?Buffer.from('image'):undefined,fetcher);
 assert.equal(calls,recipe.steps.length);
 let retries=0;await assert.rejects(()=>writeMetaStep(connection,recipe,recipe.steps[0],{},undefined,(async()=>{retries++;throw new Error(connection.token);}) as typeof fetch),e=>e instanceof MetaCreationError&&e.uncertain&&!e.message.includes(connection.token));assert.equal(retries,1);
});
test('Meta actions retain exact event types and values without summing overlapping conversion aliases',()=>{
 const rows=metaMetrics([{account_id:'123',ad_id:'456',account_currency:'USD',date_start:'2026-01-01',date_stop:'2026-01-02',actions:[{action_type:'offsite_conversion.fb_pixel_complete_registration',value:'4'},{action_type:'omni_complete_registration',value:'4'},{action_type:'link_click',value:'12'}],action_values:[{action_type:'purchase',value:'27.5'}]}],'123','456','ad','2026-01-01','2026-01-02','2026-01-03');
 assert.equal(rows.length,4);assert.equal(rows.filter(r=>r.value===4).length,2);assert.equal(rows.find(r=>r.unit==='currency')?.value,27.5);assert.ok(rows.every(r=>r.metric.length<=64));assert.ok(rows.every(r=>r.notes.includes('no sumar')));
});
test('videos are sent as private multipart MP4, need a cover, and wait for Meta encoding before ad creation',async()=>{
 const recipe=build(),step={...recipe.steps.find(s=>s.kind==='image')!,kind:'video' as const};
 const mp4=Buffer.concat([Buffer.from([0,0,0,16]),Buffer.from('ftypisom0000')]);
 const fetched=(async(input:RequestInfo|URL,init?:RequestInit)=>{assert.equal(String(input),'https://graph-video.facebook.com/v26.0/act_123/advideos');assert.ok(init?.body instanceof FormData);assert.ok(init.body.get('source') instanceof Blob);assert.equal(init.body.get('file_url'),null);return Response.json({id:'678'});}) as typeof fetch;
 assert.deepEqual(await writeMetaStep(connection,recipe,step,{},mp4,fetched),{id:'678'});
 await assert.rejects(()=>writeMetaStep(connection,recipe,step,{},Buffer.from('fake video'),fetched));
 for(const status of ['processing','ready'])assert.equal(await metaVideoReady(connection,'678',(async()=>Response.json({status:{video_status:status}})) as typeof fetch),status==='ready');
 await assert.rejects(()=>metaVideoReady(connection,'678',(async()=>Response.json({status:{video_status:'error'}})) as typeof fetch));
});

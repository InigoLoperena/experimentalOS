import {test} from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../app/api/ai/prepare/route';
import {preparationKeys} from '../lib/ai-preparation';
import {appendDictation} from '../lib/voice-audio';

for(const channel of ['meta_ads','google_ads'])test(`${channel}: a long product prompt survives a large project catalog without context rejection or silent request truncation`,async()=>{
 const original=globalThis.fetch,env={...process.env};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://context.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='unit';process.env.OPENAI_API_KEY='sk-context-test';
 const w='22222222-2222-4222-8222-222222222222',p='33333333-3333-4333-8333-333333333333',u='44444444-4444-4444-8444-444444444444';
 const description='Descripción completa del producto. '.repeat(1600)+'PRODUCT_END';
 const prompt='Prepara una campaña sobre gamificación y muebles con todas estas especificaciones. '.repeat(300)+' FINAL_INSTRUCTION: conserva la narrativa de mapa.';
 const current='Contexto que ya escribió el usuario. '.repeat(200)+'CURRENT_END';
 const records=Array.from({length:550},(_,index)=>({id:`history-${index}`,kind:'experiment',title:`Historia ${index}`,fields:{context:'Historia común. '.repeat(400),execution_config:'PRIVATE_PROVIDER_PAYLOAD',api_key:'SECRET_NOT_CONTEXT'},updated_at:'2026-10-14'}));
 records.push({id:'older-learning',kind:'learning',title:'Gamificación muebles mapa',fields:{context:'Gamificación y muebles: hipótesis a contrastar.',execution_config:'PRIVATE_PROVIDER_PAYLOAD',api_key:'SECRET_NOT_CONTEXT'},updated_at:'2020-01-01'});
 let calls=0,recordsPages=0;
 const json=(value:unknown,count?:number)=>Response.json(value,{headers:count===undefined?{}:{'Content-Range':`0-499/${count}`}});
 globalThis.fetch=async(input,options)=>{
  const url=new URL(String(input)),path=url.pathname;
  if(path==='/auth/v1/user')return json({id:u,aud:'authenticated',role:'authenticated'});
  if(path.endsWith('/records')&&url.searchParams.has('id'))return json(url.searchParams.get('id')===`eq.${p}`?{id:p,workspace_id:w,kind:'project',title:'Greenhunt',fields:{description,north_star:'Objetos rescatados',site_url:'https://greenhunt.net/',api_key:'SECRET_PROJECT'},updated_at:'2026-10-14'}:{id:'66666666-6666-4666-8666-666666666666'});
  if(path.endsWith('/record_attachments')){assert.equal(url.searchParams.get('workspace_id'),`eq.${w}`);assert.equal(url.searchParams.get('record_id'),'eq.66666666-6666-4666-8666-666666666666');return json([{name:'valorization.png',kind:'image'},{name:'tutorial-report.png',kind:'image'}]);}
  if(path.endsWith('/members'))return json({role:'owner'});
  if(path.endsWith('/rpc/can_record_action'))return json(true);
  if(path.endsWith('/integration_connections'))return json({id:'openai',provider:'openai',enabled:true,source:'environment',config:{}});
  if(path.endsWith('/rpc/search_workspace_memory')){assert.equal(JSON.parse(String(options?.body)).w,w);return json({sources:[{id:'older-learning',kind:'learning',title:'Gamificación muebles mapa',project_id:p,date:'2020-01-01',excerpt:'Gamificación y muebles: hipótesis a contrastar.'}],coverage:{available:551}});}
  if(path.endsWith('/rpc/workspace_metric_facts'))return json([]);
  if(path.endsWith('/records')&&url.searchParams.get('kind')==='eq.project')return json([{id:p,kind:'project',title:'Greenhunt',fields:{description,north_star:'Objetos rescatados',api_key:'SECRET_PROJECT'},updated_at:'2026-10-14'}]);
  if(path.endsWith('/records')&&url.searchParams.get('kind')==='eq.north_star')return json([],0);
  if(path.endsWith('/records')||path.endsWith('/ai_knowledge')){
   assert.equal(url.searchParams.get('workspace_id'),`eq.${w}`);assert.equal(url.searchParams.get('project_id'),`eq.${p}`);
   if(path.endsWith('/ai_knowledge'))return json([],0);
   recordsPages++;const from=Number(url.searchParams.get('offset')||0),size=Number(url.searchParams.get('limit'));return json(records.slice(from,from+size),records.length);
  }
  if(path.endsWith('/rpc/reserve_ai_preparation'))return json(0.03);
  if(url.origin==='https://api.openai.com'){
   calls++;const payload=JSON.parse(String(options?.body)),content=payload.input[0].content;
   assert.equal(content.at(-1).text,`Solicitud actual del usuario (incluye sus respuestas más recientes):\n${prompt}`);
   const context=JSON.parse(content[0].text.split('\n').slice(1).join('\n'));
   assert.equal(context.channel,channel);assert.equal(context.project.fields.description,description);assert.equal(context.project.fields.site_url,'https://greenhunt.net/');assert.equal(context.current.context,current);
   assert.deepEqual(context.saved_materials,[{name:'valorization.png',kind:'image'},{name:'tutorial-report.png',kind:'image'}]);
   assert.ok(Buffer.byteLength(JSON.stringify(context.knowledge))<=24000);
   assert.equal(context.methodology.scope,'common');
   assert.equal(context.methodology.sources.length,3);
   assert.match(JSON.stringify(context.methodology),/The Mom Test|El Mom Test/);
   assert.match(payload.instructions,/biblioteca methodology/);
   assert.ok(context.context_ids.includes('older-learning'));assert.ok(context.coverage.included<context.coverage.available);
   assert.doesNotMatch(JSON.stringify(context),/SECRET_NOT_CONTEXT|PRIVATE_PROVIDER_PAYLOAD|SECRET_PROJECT/);
   assert.equal(payload.store,false);
   return json({status:'completed',model:payload.model,output:[{content:[{type:'output_text',text:JSON.stringify({title:'Campaña propuesta',fields:Object.fromEntries(preparationKeys.map(key=>[key,null])),missing:[],assumptions:[],questions:[],recommendations:[],channel,execution:null})}]}]});
  }
  throw new Error(`Unexpected endpoint ${path}`);
 };
 try{
  const response=await POST(new Request('https://app.test/api/ai/prepare',{method:'POST',headers:{Authorization:'Bearer unit','Content-Type':'application/json'},body:JSON.stringify({project_id:p,experiment_id:'66666666-6666-4666-8666-666666666666',request_id:'55555555-5555-4555-8555-555555555555',prompt,fields:{channel,context:current},media:[],documents:[]})}));
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.proposal.channel,channel);assert.equal(calls,1);assert.equal(recordsPages,0);assert.ok(result.context_ids.includes('older-learning'));
 }finally{globalThis.fetch=original;process.env=env;}
});
test('experiment dictation appends to long prompts without truncation while explicitly bounded callers stay bounded',()=>{
 const current='Descripción detallada. '.repeat(500);
 assert.equal(appendDictation(current,'Nueva indicación.'),current.trimEnd()+'\nNueva indicación.');
 assert.throws(()=>appendDictation(current,'Nueva indicación.',4000),/límite/);
});

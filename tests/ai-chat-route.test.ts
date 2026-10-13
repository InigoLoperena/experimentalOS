import test from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../app/api/ai/chat/route';

const p='11111111-1111-4111-8111-111111111111',w='22222222-2222-4222-8222-222222222222',u='33333333-3333-4333-8333-333333333333',requestId='44444444-4444-4444-8444-444444444444';
for(const across of [false,true])test(`strategic chat uses ${across?'authorized workspace':'selected project'} context with private persistence and shared budget`,async()=>{
 const previousFetch=globalThis.fetch,env={...process.env};const operations:string[]=[];
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://unit.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-public-key';process.env.OPENAI_API_KEY='sk-unit-test';
 const project={id:p,kind:'project',workspace_id:w,title:'Prueba',fields:{description:'Marketplace',north_star:'Recogidas'},updated_at:'2026-10-13'};
 globalThis.fetch=async(input,options)=>{
  const url=new URL(String(input)),path=url.pathname;operations.push(path);
  const json=(value:unknown,count?:number)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json',...(count!==undefined?{'Content-Range':`0-${Math.max(0,count-1)}/${count}`}:{})}});
  if(path==='/auth/v1/user')return json({id:u,aud:'authenticated',role:'authenticated',email:'test@example.com'});
  if(path==='/rest/v1/records'&&url.searchParams.has('id'))return json(project);
  if(path==='/rest/v1/rpc/can_record_action')return json(false); // A reader may ask, but cannot create experiments.
  if(path==='/rest/v1/integration_connections')return json({id:'connection',enabled:true,source:'environment',provider:'openai',workspace_id:w,config:{}});
  if(path==='/rest/v1/rpc/reserve_ai_chat'){
   assert.deepEqual(JSON.parse(String(options?.body)),{p_workspace:w,p_request:requestId});return json(0.03);
  }
  if(url.origin==='https://api.openai.com'){
   const body=JSON.parse(String(options?.body));assert.equal(body.store,false);assert.equal(body.model,'gpt-4.1-mini-2025-04-14');
   assert.match(body.input[0].content[0].text,/Marketplace/);assert.match(body.input[0].content[0].text,/clientes piden mapa/);assert.match(body.input[0].content[0].text,/can_create\":false/);
   if(across)assert.match(body.input[0].content[0].text,/Proyecto autorizado dos/);else assert.doesNotMatch(body.input[0].content[0].text,/Proyecto autorizado dos/);
   assert.doesNotMatch(body.input[0].content[0].text,/sk-unit-test/);
   assert.match(body.input[0].content[0].text,/campaign_statuses/);assert.match(body.input[0].content[0].text,/paused/);
   assert.match(body.instructions,/no demuestran publicación ni ejecución/);assert.match(body.instructions,/estados estructurados tienen prioridad/);
   return json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({answer:'Según las entrevistas, probar un mapa es una hipótesis.\n\nSe han ejecutado campañas A/B.',source_ids:['55555555-5555-4555-8555-555555555555','fabricated'],proposal:{ignored:'reader has no create permission'}})}]}]});
  }
  if(path.startsWith('/rest/v1/')){
   if(options?.method==='POST'){
    assert.equal(path,'/rest/v1/ai_chat_entries');const entry=JSON.parse(String(options.body));assert.equal(entry.user_id,u);assert.equal(entry.project_id,p);assert.equal(entry.workspace_id,w);assert.equal(entry.proposal,null);assert.equal(entry.sources.length,1);assert.doesNotMatch(entry.answer,/Se han ejecutado/);assert.match(entry.answer,/Hay campañas o anuncios preparados/);return json({...entry,created_at:'2026-10-13'});
   }
   assert.equal(url.searchParams.get('workspace_id'),`eq.${w}`);assert.equal(url.searchParams.get('project_id'),path==='/rest/v1/ai_chat_entries'||!across?`eq.${p}`:null);
   if(path==='/rest/v1/ai_chat_entries')assert.equal(url.searchParams.get('user_id'),`eq.${u}`);
   if(path==='/rest/v1/records')return json([...(across?[{...project,id:'66666666-6666-4666-8666-666666666666',title:'Proyecto autorizado dos'}]:[]),{...project,id:'77777777-7777-4777-8777-777777777777',kind:'experiment',title:'Campaña preparada'}],across?2:1);
   if(path==='/rest/v1/external_resources')return json([{id:'88888888-8888-4888-8888-888888888888',experiment_id:'77777777-7777-4777-8777-777777777777',provider:'meta_ads',resource_type:'campaign',observed_status:'paused',updated_at:'2026-10-13'}],1);
   if(path==='/rest/v1/ai_knowledge')return json([{id:'55555555-5555-4555-8555-555555555555',title:'Entrevista',content:'Los clientes piden mapa',format:'text',source:'Entrevistas',validation:'unverified',created_at:'2026-10-13'}],1);
   return json([],0);
  }
  throw new Error(`Unexpected endpoint ${path}`);
 };
 try{
  const result=await POST(new Request('https://app.test/api/ai/chat',{method:'POST',headers:{Authorization:'Bearer test-user-token','Content-Type':'application/json'},body:JSON.stringify({project_id:p,request_id:requestId,question:'¿Qué dicen las entrevistas?',include_other_projects:across})}));
  const body=await result.json();assert.equal(result.status,200,JSON.stringify(body));assert.equal(body.entry.proposal,null);assert.equal(body.entry.sources.length,1);
  assert.ok(operations.indexOf('/auth/v1/user')<operations.indexOf('/rest/v1/rpc/reserve_ai_chat'));
  assert.ok(operations.indexOf('/rest/v1/rpc/reserve_ai_chat')<operations.indexOf('/v1/responses'));
  assert.equal(result.headers.get('Cache-Control'),'no-store');
  assert.equal(body.entry.coverage.scope,across?'workspace':'project');
 }finally{globalThis.fetch=previousFetch;process.env=env;}
});
test('chat refuses an unauthenticated request before reading memory or spending API budget',async()=>{
 const response=await POST(new Request('https://app.test/api/ai/chat',{method:'POST',body:'{}'}));
 assert.equal(response.status,401);assert.match((await response.json()).error,/sesión/);
});

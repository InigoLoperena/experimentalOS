import test from 'node:test';
import assert from 'node:assert/strict';
import {POST as chat} from '../app/api/ai/chat/route';
import {POST as prepare} from '../app/api/ai/prepare/route';
import {preparationKeys} from '../lib/ai-preparation';

test('chat and experiment preparation combine the same central library with two isolated workspaces, keys and private history',async()=>{
  const env={...process.env},original=globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://knowledge.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-test';
  process.env.OPENAI_API_KEY='sk-tenant-inference';process.env.OPENAI_LIBRARY_API_KEY='sk-shared-retrieval';process.env.OPENAI_SHARED_VECTOR_STORE_ID='vs_shared';
  const user='11111111-1111-4111-8111-111111111111';let calls=0;
  try{for(const [workspace,project,label]of [['22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','PRIVATE_A'],['33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555','PRIVATE_B']]){
    let reserved=false,libraryUnavailable=false,budgetDenied=false,externalCalls=0;const json=(value:unknown)=>Response.json(value);
    const record={id:project,workspace_id:workspace,kind:'project',title:label,fields:{description:`${label} context`,north_star:'Usuarios activados'},updated_at:'2026-10-16'};
    globalThis.fetch=async(input,options)=>{
      const url=new URL(String(input)),path=url.pathname;
      if(path==='/auth/v1/user')return json({id:user});
      if(path==='/rest/v1/workspaces')return json({id:workspace,name:label});
      if(path==='/rest/v1/records'&&url.searchParams.has('id'))return json(record);
      if(path==='/rest/v1/members')return json({role:'owner'});
      if(path==='/rest/v1/integration_connections')return json({id:'openai',enabled:true,source:'environment',provider:'openai',config:{}});
      if(path==='/rest/v1/rpc/can_record_action')return json(true);
      if(path==='/rest/v1/rpc/search_workspace_memory'){
        assert.equal(JSON.parse(String(options?.body)).w,workspace);
        return json({sources:[{id:`source-${label}`,title:`Learning ${label}`,kind:'learning',project_id:project,excerpt:`${label} observed evidence`,date:'2026-10-16'}],coverage:{available:1}});
      }
      if(path==='/rest/v1/rpc/workspace_metric_facts')return json([]);
      if(path.startsWith('/rest/v1/rpc/reserve_ai_')){assert.equal(JSON.parse(String(options?.body)).p_workspace,workspace);if(budgetDenied)return Response.json({message:'Budget reached'},{status:400});reserved=true;return json(0.03);}
      if(path.startsWith('/v1/vector_stores/')){
        externalCalls++;assert.ok(path.startsWith('/v1/vector_stores/vs_shared/'));
        assert.ok(reserved,'Budget reserved before OpenAI retrieval');
        assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer sk-shared-retrieval');
        assert.doesNotMatch(String(options?.body),/PRIVATE_A|PRIVATE_B|workspace_id|project_id/);
        if(libraryUnavailable)return Response.json({error:{message:'PRIVATE_PROVIDER_DIAGNOSTIC'}},{status:503});
        if(path.endsWith('/files'))return json({data:[{id:'file-general',status:'completed',attributes:{title:'Shared method',kind:'methodology'}}],has_more:false});
        return json({data:[{file_id:'file-general',filename:'method.md',score:0.9,content:[{type:'text',text:'SHARED_METHODOLOGY'}]}]});
      }
      if(path==='/v1/responses'){
        calls++;externalCalls++;assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer sk-tenant-inference');
        const body=JSON.parse(String(options?.body)),context=body.input[0].content[0].text;
        assert.equal(body.store,false);if(libraryUnavailable)assert.doesNotMatch(context,/SHARED_METHODOLOGY|PRIVATE_PROVIDER_DIAGNOSTIC/);else assert.match(context,/SHARED_METHODOLOGY/);assert.match(context,new RegExp(label));
        assert.doesNotMatch(context,label==='PRIVATE_A'?/PRIVATE_B/:/PRIVATE_A/);assert.doesNotMatch(context,/OBSOLETE_REFERENCE|sk-shared|sk-tenant/);
        assert.match(body.instructions,/hechos observados del equipo, hipótesis y recomendaciones/);
        const proposal={title:'Experimento propuesto',fields:Object.fromEntries(preparationKeys.map(key=>[key,null])),missing:[],assumptions:[],questions:[],recommendations:[],channel:'meta_ads',execution:null};
        return json({status:'completed',model:body.model,output:[{content:[{type:'output_text',text:JSON.stringify(body.text.format.name==='strategic_chat'?{answer:'Método general y evidencia del equipo, todavía sin validar la hipótesis.',source_ids:['general:file-general',`source-${label}`,'source-other-team'],proposal:null}:proposal)}]}]});
      }
      if(path==='/rest/v1/ai_chat_entries'&&options?.method==='POST'){
        const entry=JSON.parse(String(options.body));assert.equal(entry.workspace_id,workspace);assert.equal(entry.user_id,user);assert.equal(entry.sources.length,libraryUnavailable?1:2);assert.equal(entry.coverage.general_library.storage,'openai');return json(entry);
      }
      if(path.startsWith('/rest/v1/')){
        assert.equal(url.searchParams.get('workspace_id'),`eq.${workspace}`);
        if(path.endsWith('/ai_chat_entries')){assert.equal(url.searchParams.get('user_id'),`eq.${user}`);return json([{question:'Earlier',answer:'OBSOLETE_REFERENCE',sources:[{id:'general:file-removed'}],proposal:null}]);}
        if(path.endsWith('/records'))return json(url.searchParams.get('kind')==='eq.north_star'?[]:[record]);
        return json([]);
      }
      throw new Error(`Unexpected ${path}`);
    };
    const headers={Authorization:'Bearer test','Content-Type':'application/json'},request_id='66666666-6666-4666-8666-666666666666';
    let response:Response=await chat(new Request('https://app.test/api/ai/chat',{method:'POST',headers,body:JSON.stringify({workspace_id:workspace,project_id:project,request_id,question:'Cómo diseñar entrevistas',vector_store_id:'vs_attacker'})}));
    assert.equal(response.status,200,JSON.stringify(await response.json()));reserved=false;
    response=await prepare(new Request('https://app.test/api/ai/prepare',{method:'POST',headers,body:JSON.stringify({project_id:project,request_id,prompt:'Diseña un experimento A/B con entrevistas',fields:{channel:'meta_ads'},vector_store_id:'vs_attacker'})}));
    const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert.equal(data.context_coverage.general_library.storage,'openai');assert.equal(data.context_coverage.general_library.included,1);
    reserved=false;libraryUnavailable=true;
    response=await chat(new Request('https://app.test/api/ai/chat',{method:'POST',headers,body:JSON.stringify({workspace_id:workspace,project_id:project,request_id,question:'Cómo diseñar entrevistas'})}));
    const degraded=await response.json();assert.equal(response.status,200,JSON.stringify(degraded));assert.equal(degraded.entry.coverage.general_library.status,'unavailable');assert.match(degraded.entry.coverage.warning,/biblioteca general/);
    reserved=false;budgetDenied=true;const before=externalCalls;
    response=await chat(new Request('https://app.test/api/ai/chat',{method:'POST',headers,body:JSON.stringify({workspace_id:workspace,project_id:project,request_id,question:'Cómo diseñar entrevistas'})}));
    assert.equal(response.status,429);assert.equal(externalCalls,before,'No retrieval or generation after a refused budget reservation');
  }assert.equal(calls,6);}finally{globalThis.fetch=original;process.env=env;}
});

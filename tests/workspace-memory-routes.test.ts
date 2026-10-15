import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {POST as indexDocument} from '../app/api/ai/documents/route';
import {POST as syncResults} from '../app/api/ai/sync/route';
import {persistProviderResult} from '../lib/provider-result-memory';
import type {ExternalResource} from '../lib/monitoring';
const w='22222222-2222-4222-8222-222222222222',u='33333333-3333-4333-8333-333333333333',id='44444444-4444-4444-8444-444444444444';
test('document endpoint indexes a complete authorized original once, recovers a partial link and rejects missing bytes or workspace access',async()=>{
 const original=globalThis.fetch,env={...process.env};process.env.NEXT_PUBLIC_SUPABASE_URL='https://documents.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-unit';
 const text='Fuente sintética: una variable por experimento.',bytes=new TextEncoder().encode(text);let authorized=true,permission=true,stored=false,linked=false,complete=true,downloads=0,inserts=0,patchFails=false;
 globalThis.fetch=async(input,options)=>{
  const url=new URL(String(input)),path=url.pathname,json=(value:unknown)=>Response.json(value);
  if(path==='/auth/v1/user')return json({id:u,aud:'authenticated',role:'authenticated'});
  if(path==='/rest/v1/workspaces')return authorized?json({id:w,name:'Unit team'}):Response.json({message:'not accessible'},{status:403});
  if(path==='/rest/v1/rpc/can_record_action')return json(permission);
  if(path==='/rest/v1/ai_documents'){
   assert.equal(url.searchParams.get('workspace_id'),`eq.${w}`);assert.equal(url.searchParams.get('id'),`eq.${id}`);
   if(options?.method==='PATCH'){if(patchFails)return Response.json({message:'write interrupted'},{status:503});linked=true;return new Response(null,{status:204});}
   return json({id,workspace_id:w,project_id:null,knowledge_id:linked?id:null,name:'notes.txt',size:bytes.length,storage_path:`${w}/${id}/original`});
  }
  if(path==='/rest/v1/ai_knowledge'){
   if(options?.method==='POST'){const row=JSON.parse(String(options.body));assert.equal(row.workspace_id,w);assert.equal(row.project_id,null);assert.equal(row.id,id);assert.equal(row.content,text);assert.equal(row.validation,'unverified');assert.equal(row.category,'research');stored=true;inserts++;return new Response(null,{status:201});}
   assert.equal(url.searchParams.get('workspace_id'),`eq.${w}`);return stored?json({id}):new Response(null,{status:200});
  }
  if(path.startsWith('/storage/v1/object/')){assert.ok(path.endsWith(`/ai-documents/${w}/${id}/original`));downloads++;return new Response(complete?bytes:bytes.subarray(0,2),{headers:{'Content-Type':'text/plain'}});}
  throw new Error(`Unexpected request ${path}`);
 };
 const call=()=>indexDocument(new Request('https://app.test/api/ai/documents',{method:'POST',headers:{Authorization:'Bearer unit-session','Content-Type':'application/json'},body:JSON.stringify({workspace_id:w,document_id:id})}));
 try{
  complete=false;assert.equal((await call()).status,409);assert.equal(inserts,0);
  complete=true;patchFails=true;assert.equal((await call()).status,503);assert.equal(inserts,1);assert.equal(downloads,2);
  patchFails=false;assert.equal((await call()).status,200);assert.equal(inserts,1);assert.equal(downloads,2);
  assert.equal((await call()).status,200);assert.equal(downloads,2);
  permission=false;assert.equal((await call()).status,403);authorized=false;assert.equal((await call()).status,403);assert.equal(downloads,2);
 }finally{globalThis.fetch=original;process.env=env;}
});
test('provider persistence checks edit permission, uses scoped atomic storage and never reports failed or oversized writes as saved',async()=>{
 let writable=false,fail=false;const calls:{name:string;args:any}[]=[];
 const client={rpc:async(name:string,args:unknown)=>{calls.push({name,args});return name==='can_record_action'?{data:writable,error:null}:{data:null,error:fail?{message:'not saved'}:null};}} as unknown as SupabaseClient;
 const resource={id,workspace_id:w} as ExternalResource,report={status:'paused',metrics:[]};
 assert.equal((await persistProviderResult(client,resource,report,[],null,null)).saved,false);assert.equal(calls.length,1);
 writable=true;assert.equal((await persistProviderResult(client,resource,report,[],null,null)).saved,true);
 const write=calls.find(c=>c.name==='save_provider_result')!;assert.equal(write.args.r,id);assert.deepEqual(write.args.p_data,report);assert.match(write.args.p_hash,/^[0-9a-f]{64}$/);
 fail=true;assert.equal((await persistProviderResult(client,resource,report,[],null,null)).saved,false);
 const writes=calls.filter(c=>c.name==='save_provider_result').length;assert.equal((await persistProviderResult(client,resource,{text:'x'.repeat(500001)},[],null,null)).saved,false);assert.equal(calls.filter(c=>c.name==='save_provider_result').length,writes);
});
test('document indexing and workspace synchronization reject missing authentication before any processing',async()=>{
 for(const handler of[indexDocument,syncResults]){const response=await handler(new Request('https://app.test/api/ai',{method:'POST',body:'{}'}));assert.equal(response.status,401);}
});

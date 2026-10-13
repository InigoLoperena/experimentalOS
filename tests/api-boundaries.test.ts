import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {readJsonBody} from '../lib/request-body';
import {POST as chat} from '../app/api/ai/chat/route';
import {POST as ai} from '../app/api/ai/prepare/route';
import {POST as integrations} from '../app/api/integrations/route';
import {POST as meta} from '../app/api/meta/route';
import {POST as metaPrepare} from '../app/api/meta/prepare/route';
import {POST as metaBuild} from '../app/api/meta/build/route';
import {POST as google} from '../app/api/google-ads/route';
import {POST as googlePrepare} from '../app/api/google-ads/prepare/route';
import {POST as smartlead} from '../app/api/smartlead/route';
import {POST as smartleadPrepare} from '../app/api/smartlead/prepare/route';
import {POST as metricool} from '../app/api/metricool/route';
import {POST as posthog} from '../app/api/posthog/route';

const routes=[['ai/chat',chat,32000],['ai/prepare',ai,2200000],['integrations',integrations,60000],['meta',meta,5000],['meta/prepare',metaPrepare,3000],['meta/build',metaBuild,30000],['google-ads',google,5000],['google-ads/prepare',googlePrepare,5000],['smartlead',smartlead,5000],['smartlead/prepare',smartleadPrepare,5000],['metricool',metricool,4000],['posthog',posthog,5000]] as const;
for(const [path,handler,limit] of routes){
 for(const mode of ['unauthenticated','malformed','oversized'] as const)test(`${path} rejects ${mode} input before querying data or calling providers`,async()=>{
  const env={...process.env},previous=globalThis.fetch;let calls=0;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://unit.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-public';
  globalThis.fetch=async input=>{
   calls++;assert.equal(new URL(String(input)).pathname,'/auth/v1/user');
   return new Response(JSON.stringify({id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated'}),{headers:{'Content-Type':'application/json'}});
  };
  try{
   const request=new NextRequest(`https://app.test/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(mode==='unauthenticated'?{}:{Authorization:'Bearer test-user-token'})},body:mode==='oversized'?JSON.stringify({payload:'x'.repeat(limit)}):'null'});
   assert.equal(request.headers.get('content-length'),null);
   const response=await handler(request);assert.equal(response.status,mode==='unauthenticated'?401:mode==='oversized'?413:400);
   assert.match(response.headers.get('Cache-Control')||'',/no-store/);
   assert.equal(typeof (await response.json()).error,'string');assert.equal(calls,mode==='unauthenticated'?0:1);
  }finally{globalThis.fetch=previous;process.env=env;}
 });
}
test('JSON byte bounds work across chunks, false content-length and split multibyte characters',async()=>{
 const bytes=new TextEncoder().encode('{"question":"Hipótesis 🚀"}');
 const request=()=>new Request('https://app.test',{method:'POST',headers:{'Content-Length':'1'},body:new ReadableStream({start(controller){for(const byte of bytes)controller.enqueue(new Uint8Array([byte]));controller.close();}}),duplex:'half'} as RequestInit);
 assert.deepEqual(await readJsonBody(request(),bytes.length),{question:'Hipótesis 🚀'});
 await assert.rejects(readJsonBody(request(),bytes.length-1),{status:413});
 for(const body of ['[]','true','null','"text"','{bad'])await assert.rejects(readJsonBody(new Request('https://app.test',{method:'POST',body}),100),{status:400});
});

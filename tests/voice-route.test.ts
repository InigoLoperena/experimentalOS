import test from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../app/api/ai/transcribe/route';
import {encodeVoiceWav,voiceModel} from '../lib/voice-audio';

const projectId='11111111-1111-4111-8111-111111111111',workspaceId='22222222-2222-4222-8222-222222222222',userId='33333333-3333-4333-8333-333333333333',requestId='44444444-4444-4444-8444-444444444444';
function audioForm(purpose='chat',silent=false){
 const data=Float32Array.from({length:16000},(_,i)=>silent?0:0.2*Math.sin(i*2*Math.PI*220/16000));
 let wav:Uint8Array;
 if(silent){const signal=Float32Array.from({length:16000},(_,i)=>0.2*Math.sin(i*2*Math.PI*220/16000));wav=encodeVoiceWav({duration:1,sampleRate:16000,length:signal.length,numberOfChannels:1,getChannelData:()=>signal});wav.fill(0,44);}
 else wav=encodeVoiceWav({duration:1,sampleRate:16000,length:data.length,numberOfChannels:1,getChannelData:()=>data});
 const form=new FormData();form.set('project_id',projectId);form.set('request_id',requestId);form.set('purpose',purpose);form.set('audio',new Blob([new Uint8Array(wav)],{type:'audio/wav'}),'dictado.wav');return form;
}
for(const scenario of ['chat','experiment-denied','foreign-project','silence','provider-error'] as const)test(`voice API: ${scenario}`,async()=>{
 const previousFetch=globalThis.fetch,env={...process.env},calls:string[]=[];
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://unit.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-public-key';process.env.OPENAI_API_KEY='sk-unit-test';
 globalThis.fetch=async(input,options)=>{
  const url=new URL(String(input));calls.push(url.pathname);
  const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  if(url.pathname==='/auth/v1/user')return json({id:userId,aud:'authenticated',role:'authenticated'});
  if(url.pathname==='/rest/v1/records')return scenario==='foreign-project'?json({message:'no access'},406):json({id:projectId,workspace_id:workspaceId,title:'Greenhunt',kind:'project'});
  if(url.pathname==='/rest/v1/rpc/can_record_action')return json(false);
  if(url.pathname==='/rest/v1/integration_connections')return json({id:'connection',workspace_id:workspaceId,provider:'openai',enabled:true,source:'environment',config:{}});
  if(url.pathname==='/rest/v1/rpc/reserve_ai_transcription'){assert.deepEqual(JSON.parse(String(options?.body)),{p_workspace:workspaceId,p_request:requestId});return json(0.03);}
  if(url.origin==='https://api.openai.com'){
   assert.equal(url.pathname,'/v1/audio/transcriptions');assert.equal(options?.redirect,'error');const form=options?.body as FormData;
   assert.equal(form.get('model'),voiceModel);assert.equal(form.get('response_format'),'json');assert.equal((form.get('file') as File).name,'dictado.wav');assert.equal((form.get('file') as File).size,32044);assert.ok(!form.has('store'));
   if(scenario==='provider-error')return json({error:{message:'Never expose sk-unit-test or provider secrets'}},401);
   return json({text:'Diseña dos variantes de un experimento.'});
  }
  throw new Error('Unexpected endpoint');
 };
 try{
  const response=await POST(new Request('https://app.test/api/ai/transcribe',{method:'POST',headers:{Authorization:'Bearer user-token'},body:audioForm(scenario==='experiment-denied'?'experiment':'chat',scenario==='silence')}));const body=await response.json();
  if(scenario==='chat'){assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.text,'Diseña dos variantes de un experimento.');assert.equal(body.seconds,1);assert.equal(body.reserved_usd,0.03);assert.equal(response.headers.get('Cache-Control'),'no-store');}
  else{assert.equal(response.status,scenario==='silence'?400:scenario==='provider-error'?503:403,JSON.stringify(body));assert.doesNotMatch(JSON.stringify(body),/sk-unit-test|provider secrets/);}
  if(['experiment-denied','foreign-project','silence'].includes(scenario)){assert.ok(!calls.includes('/v1/audio/transcriptions'));assert.ok(!calls.includes('/rest/v1/rpc/reserve_ai_transcription'));}
  assert.ok(!calls.some(path=>path.includes('/storage/')||path.includes('ai_chat_entries')));
 }finally{globalThis.fetch=previousFetch;process.env=env;}
});
test('voice requires authentication before reading any upload',async()=>{const response=await POST(new Request('https://app.test/api/ai/transcribe',{method:'POST',body:'not an upload'}));assert.equal(response.status,401);});

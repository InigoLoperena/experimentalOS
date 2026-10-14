import {test} from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../app/api/google-ads/route';
import {googleDeliveryState} from '../lib/google-delivery';

test('delivery status is tenant-scoped and distinguishes unsent, uncertain and confirmed resources',async()=>{
 const env={...process.env},original=globalThis.fetch;
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://status.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='unit';
 const w='22222222-2222-4222-8222-222222222222',p='33333333-3333-4333-8333-333333333333',e='44444444-4444-4444-8444-444444444444';
 let foreign=false,pending=false,linked=false;
 globalThis.fetch=async(input)=>{
  const url=new URL(String(input)),path=url.pathname;
  if(path==='/auth/v1/user')return Response.json({id:'55555555-5555-4555-8555-555555555555',role:'authenticated',aud:'authenticated'});
  if(path.endsWith('/records'))return Response.json(url.searchParams.get('kind')==='eq.project'?{id:p,workspace_id:w,kind:'project'}:foreign?null:{id:e});
  if(path.endsWith('/external_resources')||path.endsWith('/google_ads_preparations')){
   assert.equal(url.searchParams.get('workspace_id'),`eq.${w}`);assert.equal(url.searchParams.get('project_id'),`eq.${p}`);assert.equal(url.searchParams.get('experiment_id'),`eq.${e}`);
   if(path.endsWith('/external_resources')){assert.equal(url.searchParams.get('provider'),'eq.google_ads');assert.equal(url.searchParams.get('resource_type'),'eq.campaign');return Response.json(linked?[{external_id:'123',label:'Experimento · Test',observed_status:'paused'}]:[]);}
   return Response.json(pending?[{status:'uncertain'}]:[]);
  }
  throw new Error(`Unexpected data transmission: ${path}`);
 };
 const call=()=>POST(new Request('https://app.test/api/google-ads',{method:'POST',headers:{Authorization:'Bearer unit','Content-Type':'application/json'},body:JSON.stringify({action:'status',project_id:p,experiment_id:e})}));
 try{
  let response=await call();assert.equal(response.status,200);assert.deepEqual(await response.json(),{campaigns:[],pending:false});
  pending=true;response=await call();assert.equal((await response.json()).pending,true);
  pending=false;linked=true;response=await call();const result=await response.json();assert.equal(result.campaigns[0].id,'123');assert.equal(result.campaigns[0].live,false);assert.equal(googleDeliveryState(result.campaigns[0]),'Creada · pausada');
  assert.equal(googleDeliveryState({...result.campaigns[0],status:'ENABLED'}),'Creada · activa');
  foreign=true;response=await call();assert.equal(response.status,403);
 }finally{globalThis.fetch=original;process.env=env;}
});

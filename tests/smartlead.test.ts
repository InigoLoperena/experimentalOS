import {test} from 'node:test';
import assert from 'node:assert/strict';
import {smartleadCampaigns,smartleadReport,smartleadMetrics} from '../lib/smartlead';
import {smartleadSequence,smartleadHtml,smartleadVerifyDraft,smartleadWrite,SmartleadWriteError,type SmartleadRecipe} from '../lib/smartlead-build';
const connection={key:'test-secret',revision:'2026-10-12'};
const recipe:SmartleadRecipe={name:'EXP-Test',revision:'1',connection_revision:'2',variants:[{id:'a',label:'A',subject:'Hello',body:'Version A',allocation:50},{id:'b',label:'B',subject:'Hi',body:'Version B',allocation:50}]};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
test('Smartlead authentication stays at fixed provider and errors never expose keys',async()=>{
 const fetcher=(async(url:URL,options:RequestInit)=>{assert.equal(url.origin,'https://server.smartlead.ai');assert.equal(url.searchParams.get('api_key'),'test-secret');assert.equal(options.redirect,'error');return reply([{id:123,name:'Pilot',status:'DRAFTED'}]);}) as typeof fetch;
 assert.equal((await smartleadCampaigns(connection,fetcher))[0].id,'123');
 await assert.rejects(smartleadCampaigns(connection,(async()=>reply({error:'test-secret'},401)) as typeof fetch),e=>e instanceof Error&&!e.message.includes('test-secret'));
});
test('Smartlead reports explicit UTC periods and rejects rows from other campaigns',async()=>{
 const fetcher=(async(url:URL)=>{if(url.pathname.endsWith('/campaigns/123'))return reply({id:123,name:'Pilot',status:'DRAFTED'});assert.equal(url.searchParams.get('campaign_ids'),'123');assert.equal(url.searchParams.get('timezone'),'UTC');return reply({ok:true,data:{campaign_wise_performance:[{id:123,sent:20,opened:15,replied:2,unique_lead_count:18}]}});}) as typeof fetch;
 const report=await smartleadReport(connection,'123','2026-10-01','2026-10-08',fetcher);
 assert.equal(report.metrics.find(v=>v.metric==='emails_sent')?.value,20);assert.ok(!report.metrics.some(v=>v.metric==='email_bounces'));
 await assert.rejects(smartleadReport(connection,'123','2026-10-01','2026-10-08',(async(url:URL)=>url.pathname.endsWith('/123')?reply({id:123,name:'Pilot'}):reply({data:{campaign_wise_performance:[{id:999,sent:3}]}})) as typeof fetch));
 assert.throws(()=>smartleadMetrics({sent:-1},'123','2026-10-01','2026-10-08'));
});
test('A/B draft uses one first step with two variants, no activation or recipients',()=>{
 const payload=smartleadSequence(recipe);assert.equal(payload.length,1);assert.equal(payload[0].seq_number,1);assert.equal(payload[0].variants.length,2);assert.equal(payload[0].variant_distribution_type,'MANUALLY_EQUAL');assert.equal(smartleadHtml('<script>'),'<p>&lt;script&gt;</p>');
 assert.ok(!JSON.stringify(payload).includes('ACTIVE'));
});
test('Draft confirmation reads back both variants and rejects missing content or active campaigns',async()=>{
 const fetcher=(async(url:URL)=>url.pathname.endsWith('/sequences')?reply({success:true,data:[{seq_number:1,sequence_variants:recipe.variants.map(v=>({subject:v.subject,email_body:smartleadHtml(v.body)}))}]}):reply({id:123,status:'DRAFTED'})) as typeof fetch;
 assert.equal((await smartleadVerifyDraft(connection,'123',recipe,fetcher)).id,'123');
 await assert.rejects(smartleadVerifyDraft(connection,'123',recipe,(async()=>reply({id:123,status:'ACTIVE'})) as typeof fetch));
 await assert.rejects(smartleadVerifyDraft(connection,'123',recipe,(async(url:URL)=>url.pathname.endsWith('/sequences')?reply({data:[{seq_number:1,sequence_variants:[]}]}):reply({id:123,status:'DRAFTED'})) as typeof fetch));
});
test('Uncertain writes are not retried and safe API rejection is distinguished',async()=>{
 let calls=0;await assert.rejects(smartleadWrite(connection,'campaigns/create',{},(async()=>{calls++;throw Error('test-secret');}) as typeof fetch),e=>e instanceof SmartleadWriteError&&e.uncertain&&!e.message.includes('test-secret'));assert.equal(calls,1);
 await assert.rejects(smartleadWrite(connection,'campaigns/create',{},(async()=>reply({},422)) as typeof fetch),e=>e instanceof SmartleadWriteError&&!e.uncertain);
});

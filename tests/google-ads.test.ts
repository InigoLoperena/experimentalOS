import {test} from 'node:test';
import assert from 'node:assert/strict';
import {googleAccessToken,googleSearch,googleAccount,googleReport,googleMetrics} from '../lib/google-ads';
import {googleRecipe,googleOperations,googleMutate,googleCreated,GoogleMutationError} from '../lib/google-ads-build';
import {emptyExecution} from '../lib/execution-plan';
import {emptyGoogleAds} from '../lib/google-ads-options';
import type {Item} from '../lib/model';
import type {Variant} from '../lib/monitoring';
const connection={customerId:'4266261664',clientId:'client',clientSecret:'private-secret',refreshToken:'private-refresh',revision:'2026-10-12T00:00:00Z'};
const account={id:connection.customerId,name:'Green Hunt',currency:'USD',timezone:'America/New_York',test:false,manager:false};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
const fetcher=(fn:(url:string,init?:RequestInit)=>Promise<Response>)=>fn as typeof fetch;
test('OAuth uses fixed server endpoint and does not leak provider credential errors',async()=>{
 const token=await googleAccessToken(connection,fetcher(async(url,init)=>{assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(new URLSearchParams(String(init?.body)).get('refresh_token'),connection.refreshToken);assert.equal(init?.redirect,'error');return json({access_token:'short-token',token_type:'Bearer'});}));assert.equal(token,'short-token');
 await assert.rejects(googleAccessToken(connection,fetcher(async()=>json({error:connection.clientSecret},400))),e=>e instanceof Error&&!e.message.includes(connection.clientSecret));
});
test('GAQL pagination has no developer-token header, rejects repeated pages and never imports a partial result',async()=>{
 let n=0;const rows=await googleSearch(connection,'access','SELECT customer.id FROM customer',fetcher(async(url,init)=>{assert.match(url,/v25\/customers\/4266261664\/googleAds:search$/);const h=init?.headers as Record<string,string>;assert.equal(h['developer-token'],undefined);assert.equal(h['login-customer-id'],undefined);const body=JSON.parse(String(init?.body));if(n++===0)return json({results:[{a:1}],nextPageToken:'page2'});assert.equal(body.pageToken,'page2');return json({results:[{a:2}]});}));assert.equal(rows.length,2);
 await assert.rejects(googleSearch(connection,'access','query',fetcher(async()=>json({results:[],nextPageToken:'same'}))),/repitió/);
 await assert.rejects(googleSearch(connection,'access','query',fetcher(async()=>json({error:{details:[{errors:[{errorCode:{authorizationError:'CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION'}}]}]}},403))),/Explorer/);
});
test('reports preserve fractional conversions and currency micros; unknown values are not invented',async()=>{
 const values=googleMetrics({impressions:'100',clicks:'12',costMicros:'1250000',conversions:2.5},'123','USD','2026-10-01','2026-10-07');assert.equal(values.find(v=>v.metric==='spend')?.value,1.25);assert.equal(values.find(v=>v.metric==='conversions')?.value,2.5);assert.equal(values.find(v=>v.metric==='conversions')?.unit,'number');assert.deepEqual(googleMetrics({},'123','USD','2026-10-01','2026-10-07'),[]);
 assert.throws(()=>googleMetrics({clicks:0.5},'1','USD','a','b'));
 await assert.rejects(googleAccount(connection,'access',fetcher(async()=>json({results:[{customer:{id:'999',currencyCode:'USD',timeZone:'UTC'}}]}))),/confirmó/);
 let call=0;await assert.rejects(googleReport(connection,'access','123','campaign','2026-10-01','2026-10-07',fetcher(async()=>++call===1?json({results:[{customer:{id:connection.customerId,currencyCode:'USD',timeZone:'UTC'}}]}):json({results:[{campaign:{id:'999'},metrics:{clicks:10}}]}))),/otro recurso/);
 await assert.rejects(googleReport(connection,'access',"1 OR 1=1",'campaign','a','b'),/numérico/);
});
function fixture(){const p={...emptyExecution(),destination:'https://greenhunt.net/',daily_budget:10,currency:'USD',duration_days:7,google:{...emptyGoogleAds(),countries:['US'],language_ids:['1000'],keywords:['free furniture'],cpc_limit:1,eu_political:false},variants:['A','B'].map(label=>({label,description:null,headline:`Free Furniture ${label}\nFind Local Treasures\nTry Greenhunt Today`,body:'Find free furniture nearby and join the community.\nGive useful items a new life with Greenhunt.',call_to_action:null,allocation:null}))};const e={kind:'experiment',title:'QA',fields:{channel:'google_ads',start:'2026-10-13',execution_config:JSON.stringify(p)},updated_at:connection.revision} as unknown as Item;const variants=['A','B'].map((label,i)=>({id:`id${i}`,label})) as Variant[];return {e,p,variants};}
test('Search recipe requires human political declaration, current dates and complete unique RSA assets',()=>{
 const {e,p,variants}=fixture();const r=googleRecipe(e,'EXP-GREENHUNT-0042',variants,connection,account,Date.parse('2026-10-12T12:00:00Z'));assert.equal(r.end,'2026-10-19');assert.equal(r.variants.length,2);
 assert.equal(r.name,'Experimento · QA');
 const partial=googleRecipe({...e,fields:{...e.fields,start:'',execution_config:JSON.stringify({...p,currency:null,duration_days:null})}},'EXP-GREENHUNT-0042',variants,connection,account,Date.parse('2026-10-12T12:00:00Z'));
 assert.equal(partial.currency,'USD');assert.equal(partial.start,'2026-10-12');assert.equal(partial.end,null);
 const fail=(override:unknown)=>assert.throws(()=>googleRecipe({...e,fields:{...e.fields,execution_config:JSON.stringify(override)}},'EXP-GREENHUNT-0042',variants,connection,account,Date.parse('2026-10-12T12:00:00Z')));
 fail({...p,google:{...p.google,eu_political:null}});fail({...p,currency:'EUR'});fail({...p,variants:[{...p.variants[0],headline:'Only one'},p.variants[1]]});
});
test('Google batch uses verified location and languages, paused parents and ads, atomic validation then creation',async()=>{
 const {e,variants}=fixture(),r=googleRecipe(e,'EXP-GREENHUNT-0042',variants,connection,account,Date.parse('2026-10-12T12:00:00Z'));let calls=0;
 const ops=await googleOperations(connection,'access',r,fetcher(async()=>++calls===1?json({results:[{geoTargetConstant:{id:'2840',countryCode:'US'}}]}):json({results:[{languageConstant:{id:'1000',name:'English'}}]})));
 const text=JSON.stringify(ops);assert.match(text,/startDateTime/);assert.doesNotMatch(text,/"startDate"|"endDate"|targetSpendMicros/);assert.equal((ops[1].campaignOperation as any).create.status,'PAUSED');assert.equal((ops[2].adGroupOperation as any).create.status,'PAUSED');assert.equal((ops[3].adGroupAdOperation as any).create.status,'PAUSED');assert.equal((ops[3].adGroupAdOperation as any).create.ad.name,undefined);
 await googleMutate(connection,'access',ops,true,fetcher(async(_url,init)=>{const body=JSON.parse(String(init?.body));assert.equal(body.validateOnly,true);assert.equal(body.partialFailure,false);return json({});}));
 await assert.rejects(googleMutate(connection,'access',ops,false,fetcher(async()=>{throw new Error('timeout');})),e=>e instanceof GoogleMutationError&&e.uncertain);
 await assert.rejects(googleMutate(connection,'access',ops,false,fetcher(async()=>json({error:{}},400))),e=>e instanceof GoogleMutationError&&!e.uncertain);
 const rows=[{campaignBudgetResult:{resourceName:'unused'}},{campaignResult:{resourceName:'customers/4266261664/campaigns/123'}},{adGroupResult:{resourceName:'customers/4266261664/adGroups/456'}},...['789','790'].map(id=>({adGroupAdResult:{resourceName:`customers/4266261664/adGroupAds/456~${id}`}}))];const created=googleCreated(rows as any,r);assert.deepEqual(created.map(v=>v.id),['123','456','789','790']);assert.equal(created[2].variant,'id0');assert.throws(()=>googleCreated([{},{campaignResult:{resourceName:'customers/999/campaigns/123'}}],r),/IDs/);
});

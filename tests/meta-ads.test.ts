import {test} from 'node:test';
import assert from 'node:assert/strict';
import {metaConnection,metaJson,metaMetrics,metaReport,metaCampaigns,metaPeriod} from '../lib/meta-ads';
import type {Item} from '../lib/model';

const connection={accountId:'123',token:'private-test-credential'};
const reportRow={account_id:'123',campaign_id:'456',account_currency:'USD',date_start:'2026-01-01',date_stop:'2026-01-07',impressions:'100',clicks:'7',reach:'80',spend:'2.45'};

test('Meta credential stays bound to the verified workspace AND project',()=>{
  const env={META_ADS_WORKSPACE_ID:'w',META_ADS_PROJECT_ID:'p',META_ADS_ACCESS_TOKEN:connection.token,META_ADS_ACCOUNT_ID:'123'};
  const project={id:'p',workspace_id:'w'} as Item;
  assert.deepEqual(metaConnection(project,env),connection);
  assert.throws(()=>metaConnection({...project,workspace_id:'other'},env));
  assert.throws(()=>metaConnection({...project,id:'other'},env));
  assert.throws(()=>metaConnection(project,{...env,META_ADS_ACCESS_TOKEN:''}));
});

test('Meta requests use fixed versioned origin, bearer headers and never follow token-bearing paging URLs',async()=>{
  const fetcher=async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=new URL(String(input));assert.equal(url.origin,'https://graph.facebook.com');assert.equal(url.pathname,'/v26.0/act_123/campaigns');
    assert.equal(url.searchParams.has('access_token'),false);assert.equal(init?.method,'GET');assert.equal(init?.redirect,'error');
    assert.equal((init?.headers as Record<string,string>).Authorization,`Bearer ${connection.token}`);
    return Response.json({data:[{id:'456',name:'Campaign',account_id:'123',effective_status:'PAUSED'}],paging:{next:`https://malicious.test?access_token=${connection.token}`,cursors:{after:'safe-cursor'}}});
  };
  const result=await metaCampaigns(connection,'',fetcher as typeof fetch);
  assert.equal(result.next,'safe-cursor');assert.equal(result.campaigns[0].id,'456');assert.ok(!JSON.stringify(result).includes(connection.token));
  await assert.rejects(()=>metaJson('https://malicious.test',{},connection.token,fetcher as typeof fetch));
  const errorFetch=async()=>Response.json({error:{code:190,message:connection.token}},{status:400});
  await assert.rejects(()=>metaJson('456',{},connection.token,errorFetch as typeof fetch),err=>err instanceof Error && err.message.includes('caducado') && !err.message.includes(connection.token));
});

test('Reports reject foreign account resources before fetching insights',async()=>{
  let calls=0;
  const fetcher=async()=>{calls++;return Response.json({id:'456',name:'Other campaign',account_id:'999'});};
  await assert.rejects(()=>metaReport(connection,'456','campaign','2026-01-01','2026-01-07',fetcher as typeof fetch));
  assert.equal(calls,1);
});

test('Meta results preserve exact periods and missing evidence, without fabricated zeroes or conversion sums',()=>{
  const parse=(rows:unknown)=>metaMetrics(rows,'123','456','campaign','2026-01-01','2026-01-07','2026-01-08T12:00:00Z');
  assert.deepEqual(parse([]),[]);
  const rows=parse([reportRow]);assert.equal(rows.length,4);assert.equal(rows.find(row=>row.metric==='spend')?.value,2.45);
  assert.equal(rows.find(row=>row.metric==='spend')?.currency,'USD');assert.equal(rows.find(row=>row.metric==='clicks')?.currency,null);
  assert.equal(parse([{...reportRow,clicks:undefined}]).length,3);
  for(const change of [{account_id:'999'},{campaign_id:'999'},{date_stop:'2026-01-06'},{clicks:'NaN'},{impressions:'1.1'},{spend:'-1'},{account_currency:'??'}]) assert.throws(()=>parse([{...reportRow,...change}]));
  assert.throws(()=>parse([reportRow,reportRow]));
  assert.throws(()=>metaPeriod('2026-02-30','2026-03-01'));
  assert.throws(()=>metaPeriod('2026-01-01','2026-03-01'));
});

test('Valid resource report checks account identity and sends the requested date range',async()=>{
  const fetcher=async(input:RequestInfo|URL)=>{
    const url=new URL(String(input));
    if(url.pathname.endsWith('/insights')) {assert.deepEqual(JSON.parse(url.searchParams.get('time_range')!),{since:'2026-01-01',until:'2026-01-07'});return Response.json({data:[reportRow]});}
    return Response.json({id:'456',name:'Campaign',account_id:'123',effective_status:'PAUSED'});
  };
  const result=await metaReport(connection,'456','campaign','2026-01-01','2026-01-07',fetcher as typeof fetch);
  assert.equal(result.name,'Campaign');assert.equal(result.metrics.length,4);
});

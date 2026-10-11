import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Item} from '../lib/model';
import {emptyExecution} from '../lib/execution-plan';
import {pausedCampaign,campaignFingerprint,createPausedCampaign,MetaCreationError} from '../lib/meta-preparation';
import {channelProvider} from '../lib/monitoring';
const experiment={kind:'experiment',title:'Creatividades A/B',fields:{channel:'meta_ads',execution_config:JSON.stringify({...emptyExecution(),goal:'traffic'})}} as unknown as Item;
test('Meta preparation never assumes categories, platform or objective and binds a stable experiment code',()=>{
  const payload=pausedCampaign(experiment,'EXP-GREENHUNT-0042','NONE');
  assert.equal(payload.name,'EXP-GREENHUNT-0042 · Creatividades A/B');assert.equal(payload.status,'PAUSED');assert.equal(payload.objective,'OUTCOME_TRAFFIC');assert.deepEqual(payload.special_ad_categories,[]);
  assert.throws(()=>pausedCampaign(experiment,'EXP-GREENHUNT-0042',null));
  assert.throws(()=>pausedCampaign({...experiment,fields:{...experiment.fields,channel:'google_ads'}},'EXP-GREENHUNT-0042','NONE'));
  assert.throws(()=>pausedCampaign({...experiment,fields:{...experiment.fields,execution_config:JSON.stringify({...emptyExecution(),goal:'installs'})}},'EXP-GREENHUNT-0042','NONE'));
  assert.notEqual(campaignFingerprint(payload,'old'),campaignFingerprint(payload,'new'));
});
test('Meta write sends only paused campaign parameters to the bound account; no activation or budgets can pass through',async()=>{
  let calls=0;const payload=pausedCampaign(experiment,'EXP-GREENHUNT-0042','NONE');
  const fetcher=async(input:RequestInfo|URL,init?:RequestInit)=>{
    calls++;assert.equal(String(input),'https://graph.facebook.com/v26.0/act_123/campaigns');assert.equal(init?.method,'POST');assert.equal(init?.redirect,'error');
    const body=init!.body as URLSearchParams;
    assert.equal(body.get('status'),'PAUSED');assert.equal(body.get('daily_budget'),null);assert.equal(body.get('access_token'),null);assert.equal(body.get('special_ad_categories'),'[]');
    assert.equal((init!.headers as Record<string,string>).Authorization,'Bearer secret-test');return Response.json({id:'456'});
  };
  assert.equal(await createPausedCampaign({accountId:'123',token:'secret-test'},{...payload,daily_budget:999,status:'PAUSED'} as typeof payload,fetcher as typeof fetch),'456');assert.equal(calls,1);
  await assert.rejects(()=>createPausedCampaign({accountId:'123',token:'test'},{...payload,status:'ACTIVE'},fetcher as typeof fetch));assert.equal(calls,1);
});
test('Ambiguous Meta creation never retries or reveals raw credentials; explicit rejection is distinct',async()=>{
  const payload=pausedCampaign(experiment,'EXP-GREENHUNT-0042','NONE');let calls=0;
  await assert.rejects(()=>createPausedCampaign({accountId:'123',token:'secret-test'},payload,(async()=>{calls++;throw new Error('secret-test');}) as typeof fetch),err=>err instanceof MetaCreationError&&err.uncertain&&!err.message.includes('secret-test'));assert.equal(calls,1);
  await assert.rejects(()=>createPausedCampaign({accountId:'123',token:'secret-test'},payload,(async()=>Response.json({error:{code:190,message:'secret-test'}},{status:400})) as typeof fetch),err=>err instanceof MetaCreationError&&!err.uncertain&&!err.message.includes('secret-test'));
});
test('Monitoring defaults to the principal channel while preserving manual multi-resource linking',()=>{
  assert.equal(channelProvider('meta_ads'),'meta_ads');assert.equal(channelProvider('smartlead'),'smartlead');assert.equal(channelProvider('mobile_android'),'posthog');assert.equal(channelProvider('app_store'),'other');assert.equal(channelProvider('constructor'),'other');
});

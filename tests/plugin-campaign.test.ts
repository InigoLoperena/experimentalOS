import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { emptyExecution, type ExecutionPlan } from '../lib/execution-plan';
import { parsePluginCampaign } from '../lib/plugin-campaign';
import { parsePluginExperiment } from '../lib/plugin-experiment';
import { openPluginDraft, sealPluginDraft } from '../lib/plugin-draft';
import { savePluginExperiment } from '../lib/plugin-save';
import { queuedClient } from './service-fixture';
import { POST } from '../app/api/mcp/route';

export function campaignPlan(): ExecutionPlan {
  return { ...emptyExecution(), variants: [
    { label: 'A', description: 'Control', headline: 'Una pregunta breve', body: '¿Cómo resuelves hoy este problema?', call_to_action: null, allocation: 50 },
    { label: 'B', description: 'Alternativa', headline: 'Otra forma de preguntar', body: '¿Cuándo te ocurrió por última vez?', call_to_action: null, allocation: 50 },
  ] };
}
const book = { title: 'QA de campaña', context: 'Prueba sintética', hypothesis: 'Una variante obtiene más respuestas', metric: 'Respuestas', success_criteria: '3 de 10 entrevistas' };
const master = randomBytes(32).toString('hex');
test('campaign draft is encrypted with both variants; server strips no campaign or evidence fields', () => {
  const input = { ...book, campaign: { provider: 'smartlead', plan: campaignPlan() } };
  const result = parsePluginExperiment(input);
  assert.equal(result.campaign?.provider, 'smartlead');
  assert.deepEqual(result.campaign?.plan.variants, campaignPlan().variants);
  const draft = sealPluginDraft(input, Date.now(), master);
  assert.equal(openPluginDraft(draft.token, Date.now(), master).experiment.campaign?.plan.variants[1].body, campaignPlan().variants[1].body);
});
test('campaigns reject credentials, mixed providers, unsupported types and invalid A/B email setup', () => {
  for (const raw of [
    { provider: 'smartlead', plan: campaignPlan(), api_key: 'never-send' },
    { provider: 'smartlead', plan: { ...campaignPlan(), api_key: 'never-send' } },
    { provider: 'unknown', plan: campaignPlan() },
    { provider: 'smartlead', plan: { ...campaignPlan(), variants: campaignPlan().variants.slice(0, 1) } },
    { provider: 'smartlead', plan: { ...campaignPlan(), variants: campaignPlan().variants.map(v => ({ ...v, allocation: null })) } },
    { provider: 'google_ads', plan: { ...campaignPlan(), google: { type: 'APP' } } },
  ]) assert.throws(() => parsePluginCampaign(raw));
});
test('Google and Meta carry native provider parameters without selecting accounts or activating anything', () => {
  const google = { provider: 'google_ads', plan: { ...campaignPlan(), variants: campaignPlan().variants.map(v => ({ ...v, headline: `${v.label} oferta\nDescubre la propuesta\nSolicita información`, body: 'Explora esta propuesta con una prueba.\nSolicita más información sin compromiso.' })), destination: 'https://example.org/', daily_budget: 5, currency: 'USD', duration_days: 7,
    google: { type: 'SEARCH', countries: ['US'], language_ids: ['1000'], keywords: ['test'], match_type: 'PHRASE', cpc_limit: 1, eu_political: null } } };
  assert.equal(parsePluginCampaign(google).plan.google?.eu_political, null);
  const meta = { provider: 'meta_ads', plan: { ...campaignPlan(), destination: 'https://example.org/', daily_budget: 5, currency: 'USD', meta: { objective: 'traffic', countries: ['US'], city_key: null, age_min: 25, age_max: 55, placements: ['feed'], conversion_event: null } } };
  assert.equal(parsePluginCampaign(meta).plan.meta?.objective, 'traffic');
  assert.throws(() => parsePluginCampaign({ ...google, plan: { ...google.plan, meta: meta.plan.meta } }));
});
test('campaign save uses existing atomic record/variant RPC, binds identity, and preserves a retry without creating another plan', async () => {
  process.env.MCP_DRAFT_ENCRYPTION_KEY = master;
  const input = { ...book, campaign: { provider: 'smartlead', plan: campaignPlan() } }, token = sealPluginDraft(input).token;
  const user = randomUUID(), project = { id: randomUUID(), workspace_id: randomUUID(), title: 'Project' };
  const fixture = queuedClient([{ data: project, error: null }, { data: { role: 'owner' }, error: null }, { data: null, error: null }]);
  let payload: any, calls = 0;
  fixture.client.rpc = ((name: string, params: any) => {
    calls++; assert.equal(name, 'save_experiment_preparation'); assert.equal(params.p_expected, null);
    payload = params.p_record;
    return Promise.resolve({ error: null, data: [{ ...payload, created_by: user, kind: 'experiment', updated_at: 'revision' }] });
  }) as unknown as typeof fixture.client.rpc;
  const result = await savePluginExperiment(fixture.client, user, token, project.id);
  assert.equal(calls, 1); assert.equal(result.saved, true); assert.equal(result.campaign_saved, false);
  assert.equal(payload.owner_id, user); assert.equal(payload.workspace_id, project.workspace_id); assert.equal(payload.fields.channel, 'smartlead');
  assert.equal(payload.fields.campaign, undefined); assert.deepEqual(JSON.parse(payload.fields.execution_config).variants, campaignPlan().variants);
  assert.equal(fixture.calls.filter(c => c.action === 'insert').length, 0);
  const retry = queuedClient([{ data: project, error: null }, { data: { role: 'owner' }, error: null }, { data: { ...payload, created_by: user }, error: null }]);
  const repeated = await savePluginExperiment(retry.client, user, token, project.id);
  assert.equal(repeated.already_saved, true); assert.equal(repeated.experiment?.fields.channel, 'smartlead');
});
test('create-only members cannot create campaign preparations or invoke an RPC', async () => {
  process.env.MCP_DRAFT_ENCRYPTION_KEY = master;
  const project = { id: randomUUID(), workspace_id: randomUUID() }, token = sealPluginDraft({ ...book, campaign: { provider: 'smartlead', plan: campaignPlan() } }).token;
  const fixture = queuedClient([{ data: project, error: null }, { data: { role: 'editor', permissions: ['experiments.create'] }, error: null }, { data: null, error: null }]);
  await assert.rejects(savePluginExperiment(fixture.client, randomUUID(), token, project.id), /editar/);
  assert.equal(fixture.calls.filter(c => c.action === 'insert').length, 0);
});
test('public MCP campaign tool only prepares a link and never calls an ad provider', async () => {
  process.env.MCP_DRAFT_ENCRYPTION_KEY = master;
  const request = new Request('https://www.xperiments.site/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'prepare_campaign_experiment', arguments: { ...book, campaign: { provider: 'smartlead', plan: campaignPlan() } } } }) });
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Public preparation must not call a provider'); };
  try {
    const result = await (await POST(request)).json();
    assert.equal(result.result.structuredContent.saved, false); assert.equal(result.result.structuredContent.campaign_saved, false);
    assert.equal(result.result.structuredContent.provider, 'smartlead');
  } finally { globalThis.fetch = original; }
});

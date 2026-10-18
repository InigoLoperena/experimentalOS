import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { parsePluginExperiment, pluginExperimentSchema } from '../lib/plugin-experiment';
import { sealPluginDraft } from '../lib/plugin-draft';
import { savePluginExperiment } from '../lib/plugin-save';
import { queuedClient } from './service-fixture';
import { POST } from '../app/api/mcp/route';

const fields = { title: 'Prueba de entrevistas', context: 'Plan sin resultados', hypothesis: '3 de 10 aceptan una prueba', metric: 'Compromisos sobre 10 entrevistas', success_criteria: '3 de 10' };
const request = (method: string, params: unknown) => new Request('https://www.xperiments.site/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });

test('record contracts reject all execution fields before creating encrypted links', async () => {
  for (const extra of [{ campaign: null }, { campaign: { provider: 'meta_ads' } }, { provider: 'google_ads' }, { budget: 100 }, { execution_config: '{}' }]) {
    const input = { ...fields, ...extra };
    assert.throws(() => parsePluginExperiment(input), /no admitidos/);
    const reply = await (await POST(request('tools/call', { name: 'prepare_experiment_save', arguments: input }))).json();
    assert.equal(reply.result.isError, true);
    assert.equal(reply.result.structuredContent, undefined);
  }
});

test('the public MCP offers a single record tool and rejects the retired command', async () => {
  const list = await (await POST(request('tools/list', {}))).json();
  assert.deepEqual(list.result.tools.map((t: { name: string }) => t.name), ['prepare_experiment_save']);
  assert.deepEqual(list.result.tools[0].inputSchema, pluginExperimentSchema);
  const reply = await (await POST(request('tools/call', { name: 'prepare_campaign_experiment', arguments: fields }))).json();
  assert.equal(reply.error.code, -32602);
});

test('a create-only member can save a plain record without execution permissions or RPCs', async () => {
  process.env.MCP_DRAFT_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const user = randomUUID(), project = { id: randomUUID(), workspace_id: randomUUID(), title: 'Demo' };
  const token = sealPluginDraft(fields).token;
  const db = queuedClient([{ data: project, error: null }, { data: { role: 'editor', permissions: ['experiments.create'] }, error: null }, { data: null, error: null }, { data: { id: randomUUID(), title: fields.title }, error: null }]);
  db.client.rpc = (() => { throw new Error('Record saving must not prepare external execution'); }) as unknown as typeof db.client.rpc;
  const result = await savePluginExperiment(db.client, user, token, project.id);
  assert.equal(result.saved, true);
  const insert = db.calls.find(c => c.action === 'insert')!;
  assert.equal(insert.payload.workspace_id, project.workspace_id);
  assert.equal(insert.payload.owner_id, user);
  assert.equal(insert.payload.fields.execution_config, undefined);
  assert.equal(Object.hasOwn(result, 'campaign_saved'), false);
});

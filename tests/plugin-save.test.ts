import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { parsePluginExperiment } from '../lib/plugin-experiment';
import { sealPluginDraft, openPluginDraft, pluginRecordId } from '../lib/plugin-draft';
import { savePluginExperiment } from '../lib/plugin-save';
import { queuedClient } from './service-fixture';
import { POST as mcp, GET } from '../app/api/mcp/route';
import { POST as saveRoute } from '../app/api/plugin/experiments/route';

const experiment = { title: 'Entrevistas de prueba', context: 'Prueba sintética, sin clientes reales.', hypothesis: 'Tres personas aceptarán una prueba.', metric: 'Compromisos de prueba', success_criteria: '3 de 10 entrevistas', impact: 5 };
const key = randomBytes(32).toString('hex');
test('draft links encrypt content, reject tampering and expire after exactly 30 minutes', () => {
  const now = Date.now(), sealed = sealPluginDraft(experiment, now, key);
  assert.ok(!sealed.token.includes(experiment.title));
  assert.deepEqual(openPluginDraft(sealed.token, now + 1799999, key).experiment, experiment);
  assert.throws(() => openPluginDraft(sealed.token, now + 1800000, key), /caducado/);
  assert.throws(() => openPluginDraft(sealed.token.slice(0, -8) + 'AAAAAAAA', now, key), /válido/);
  assert.throws(() => openPluginDraft(sealed.token, now, '0'.repeat(64)), /válido/);
  assert.throws(() => openPluginDraft('garbage', now, key), /válido/);
});
test('drafts reject forged identity, unexpected fields, invalid dates and oversized content', () => {
  for (const fields of [{ owner_id: randomUUID() }, { project_id: randomUUID() }, { impact: 11 }, { start: '2026-02-31' }, { metric: ' ' }, { context: 'a'.repeat(2001) }]) assert.throws(() => parsePluginExperiment({ ...experiment, ...fields }));
  assert.throws(() => parsePluginExperiment({ ...experiment, context: '😀'.repeat(1000), hypothesis: '😀'.repeat(1000) }), /demasiado largo/);
  assert.notEqual(pluginRecordId('draft', 'one'), pluginRecordId('draft', 'two'));
  assert.equal(pluginRecordId('draft', 'one'), pluginRecordId('draft', 'one'));
});
test('authenticated saving binds workspace and responsible to verified project/account and preserves field values', async () => {
  process.env.MCP_DRAFT_ENCRYPTION_KEY = key;
  const projectId = randomUUID(), user = randomUUID();
  const token = sealPluginDraft(experiment).token, id = pluginRecordId(openPluginDraft(token).id, user);
  const project = { id: projectId, kind: 'project', workspace_id: randomUUID(), title: 'Proyecto QA' };
  const saved = { id, title: experiment.title, project_id: projectId, created_by: user, kind: 'experiment' };
  const db = queuedClient([{ data: project, error: null }, { data: { role: 'owner' }, error: null }, { data: null, error: null }, { data: saved, error: null }]);
  const result = await savePluginExperiment(db.client, user, token, projectId);
  assert.equal(result.saved, true); assert.equal(result.already_saved, false);
  const insert = db.calls.find(c => c.action === 'insert')!;
  assert.equal(insert.payload.workspace_id, project.workspace_id); assert.equal(insert.payload.owner_id, user);
  assert.equal(insert.payload.kind, 'experiment'); assert.equal(insert.payload.parent_id, null);
  assert.deepEqual(insert.payload.fields, { context: experiment.context, hypothesis: experiment.hypothesis, metric: experiment.metric, success_criteria: experiment.success_criteria, impact: 5 });
  const retry = queuedClient([{ data: project, error: null }, { data: { role: 'owner' }, error: null }, { data: saved, error: null }]);
  assert.equal((await savePluginExperiment(retry.client, user, token, projectId)).already_saved, true);
  assert.equal(retry.calls.filter(c => c.action === 'insert').length, 0);
  const race = queuedClient([{ data: project, error: null }, { data: { role: 'owner' }, error: null }, { data: null, error: null }, { data: null, error: { code: '23505' } }, { data: saved, error: null }]);
  assert.equal((await savePluginExperiment(race.client, user, token, projectId)).already_saved, true);
});
test('outsiders and viewers cannot insert; previously saved drafts cannot be moved to another project', async () => {
  process.env.MCP_DRAFT_ENCRYPTION_KEY = key;
  const projectId = randomUUID(), user = randomUUID(), token = sealPluginDraft(experiment).token;
  const denied = queuedClient([{ data: null, error: { code: 'no_access' } }]);
  await assert.rejects(savePluginExperiment(denied.client, user, token, projectId), /acceso/);
  for (const member of [{ role: 'viewer' }, { role: 'editor', permissions: ['experiments.edit'] }]) {
    const db = queuedClient([{ data: { id: projectId, workspace_id: randomUUID() }, error: null }, { data: member, error: null }]);
    await assert.rejects(savePluginExperiment(db.client, user, token, projectId), /permiso/);
    assert.equal(db.calls.filter(c => c.action === 'insert').length, 0);
  }
  const used = queuedClient([{ data: { id: projectId, workspace_id: randomUUID() }, error: null }, { data: { role: 'owner' }, error: null }, { data: { project_id: randomUUID(), created_by: user, kind: 'experiment' }, error: null }]);
  await assert.rejects(savePluginExperiment(used.client, user, token, projectId), /otro proyecto/);
});
const rpc = (method: string, params?: unknown, extra: Record<string,string> = {}) => new Request('https://www.xperiments.site/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...extra }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
test('MCP handshake, discovery and actual preparation return a pending encrypted link, never a false saved result', async () => {
  process.env.MCP_DRAFT_ENCRYPTION_KEY = key;
  const init = await (await mcp(rpc('initialize', { protocolVersion: '2025-11-25' }))).json();
  assert.equal(init.result.protocolVersion, '2025-11-25');
  const list = await (await mcp(rpc('tools/list'))).json(); assert.equal(list.result.tools.length, 2);
  const result = await (await mcp(rpc('tools/call', { name: 'prepare_experiment_save', arguments: experiment }))).json();
  assert.equal(result.result.structuredContent.saved, false); assert.equal(result.result.structuredContent.status, 'pending_confirmation');
  const url = new URL(result.result.structuredContent.save_url);
  assert.equal(url.host, 'www.xperiments.site'); assert.equal(url.search, '');
  assert.equal(openPluginDraft(new URLSearchParams(url.hash.slice(1)).get('draft')).experiment.title, experiment.title);
  const invalid = await (await mcp(rpc('tools/call', { name: 'prepare_experiment_save', arguments: { ...experiment, owner_id: 'forged' } }))).json();
  assert.equal(invalid.result.isError, true);
  assert.equal((await mcp(rpc('tools/list', {}, { origin: 'https://evil.example' }))).status, 403);
  assert.equal((await mcp(rpc('tools/list', {}, { 'mcp-protocol-version': 'made-up' }))).status, 400);
  assert.equal((await GET(new Request('https://www.xperiments.site/api/mcp'))).status, 405);
});
test('review and save endpoints reject unauthenticated requests before reading their payload', async () => {
  for (const action of ['review', 'save']) {
    const result = await saveRoute(new Request('https://www.xperiments.site/api/plugin/experiments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, confirmed: true, token: 'forged', project_id: randomUUID() }) }));
    assert.equal(result.status, 401);
  }
});

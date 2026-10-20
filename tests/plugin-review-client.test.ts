import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { saveReviewedPluginExperiment } from '../lib/plugin-review-client';

const client = (id?: string) => ({ auth: { getSession: async () => ({ data: { session: id ? { user: { id }, access_token: 'test-token' } : null }, error: null }) } }) as unknown as SupabaseClient;
test('changing account after reviewing blocks saving before any HTTP request', async () => {
  let calls = 0;
  const send: typeof fetch = async () => { calls++; return Response.json({ saved: true }); };
  await assert.rejects(saveReviewedPluginExperiment(client('account-b'), 'account-a', 'draft', 'project', send), /cambiado de cuenta/);
  await assert.rejects(saveReviewedPluginExperiment(client(), 'account-a', 'draft', 'project', send), /Inicia sesión/);
  assert.equal(calls, 0);
});
test('confirmed save uses the reviewing account and requires an actual saved result', async () => {
  const send: typeof fetch = async (_url, init) => {
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-token');
    assert.deepEqual(JSON.parse(init?.body as string), { action: 'save', confirmed: true, token: 'draft', project_id: 'project' });
    return Response.json({ saved: true, record_id: 'record' });
  };
  assert.equal((await saveReviewedPluginExperiment(client('a'), 'a', 'draft', 'project', send)).record_id, 'record');
  await assert.rejects(saveReviewedPluginExperiment(client('a'), 'a', 'draft', 'project', async () => Response.json({ saved: false })), /confirmado/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { pluginExperimentSchema, parsePluginExperiment } from '../lib/plugin-experiment';
import { recordMemory } from '../lib/ai-memory';
import { validate } from '../lib/model';
import { item } from './service-fixture';

test('the published plugin date schema accepts the same dates as the server parser', () => {
  const pattern = new RegExp(pluginExperimentSchema.properties.start.pattern);
  const experiment = { title: 'QA', context: 'QA', hypothesis: 'QA', metric: 'QA', success_criteria: 'QA' };
  for (const start of ['2026-10-23', '2028-02-29']) {
    assert.ok(pattern.test(start), `The public tool schema rejects ${start}`);
    assert.equal(parsePluginExperiment({ ...experiment, start }).start, start);
  }
  assert.ok(!pattern.test('23/10/2026'));
  assert.throws(() => parsePluginExperiment({ ...experiment, start: '2026-02-29' }));
});

test('experiment dates remain coherent now that both trees expose an end date', () => {
  assert.equal(validate(item('e', 'experiment', { start: '2026-10-23', end: '2026-10-22' })), 'La fecha final debe ser posterior al inicio.');
  assert.equal(validate(item('e', 'experiment', { start: '2026-10-23', end: '2026-10-23' })), null);
  assert.equal(validate(item('e', 'experiment', { start: '2026-10-23' })), null);
});

test('private AI context includes research findings and historical hypothesis reasoning without credentials', () => {
  const fields = {
    description: 'Small qualitative sample', findings: 'Observed late collection', method: 'Interviews',
    audience: 'Local residents', belief: 'Availability matters', reason: 'Earlier interviews',
    validation_need: 'Confirm actual trips', is_main_hypothesis: true, mvp_links: 'private-link',
    access_token: 'do-not-send', execution_config: 'provider-settings',
  };
  for (const kind of ['hypothesis', 'research'] as const) {
    const source = recordMemory(item(kind, kind, fields));
    for (const key of ['findings', 'method', 'audience', 'belief', 'reason', 'validation_need']) {
      assert.match(source.excerpt, new RegExp(String(fields[key as keyof typeof fields])));
    }
    assert.doesNotMatch(source.excerpt, /do-not-send|provider-settings|private-link/);
  }
});

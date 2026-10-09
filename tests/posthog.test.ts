import { test } from "node:test";
import assert from "node:assert/strict";
import { listPosthogExperiments, posthogHost, posthogIdentifier, posthogJson } from "../lib/posthog-api";
import { syncPosthogExperiments } from "../lib/posthog-sync";
import { item, queuedClient } from "./service-fixture";

test("PostHog server hosts reject credential leakage, redirects and unapproved endpoints", async () => {
  assert.equal(posthogHost("eu.posthog.com/"), "https://eu.posthog.com");
  assert.equal(posthogHost("https://analytics.example.org", "analytics.example.org"), "https://analytics.example.org");
  for (const host of ["http://us.posthog.com", "https://user:secret@us.posthog.com", "https://evil.example", "https://us.posthog.com/api", "https://us.posthog.com:9000", "https://us.posthog.com?x=1", "javascript:alert(1)"])
    assert.throws(() => posthogHost(host));
  let checked = false;
  await posthogJson("https://us.posthog.com/api/", "test-key", (async (_url, init) => {
    checked = true; assert.equal(init?.redirect, "error"); assert.ok(init?.signal); return Response.json({ ok: true });
  }) as typeof fetch);
  assert.ok(checked);
  assert.equal(posthogIdentifier("101"), "101");
  for (const id of ["..", "../42", "42/results", "42?token=secret", "%2e%2e", ""]) assert.throws(() => posthogIdentifier(id));
});

test("PostHog listing follows all pages instead of treating experiment 101 as deleted", async () => {
  let calls = 0;
  const result = await listPosthogExperiments("https://us.posthog.com", "42", "test", (async () => {
    calls++; return Response.json(calls === 1 ? { results: Array.from({ length: 100 }, (_, id) => ({ id })), next: "?offset=100" } : { results: [{ id: 101 }], next: null });
  }) as typeof fetch);
  assert.equal(calls, 2); assert.equal(result.results.length, 101); assert.equal(result.results.at(-1)?.id, 101);
});

test("partial, malformed, looping and cross-host PostHog responses fail before synchronization", async () => {
  for (const payload of [{ results: [], next: "https://evil.example/api/" }, { results: [], next: "?limit=100" },
    { results: [{ name: "Missing ID" }], next: null }, { results: null }, { results: [], next: 9 }]) {
    await assert.rejects(listPosthogExperiments("https://us.posthog.com", "42", "test", (async () => Response.json(payload)) as typeof fetch));
  }
  let calls = 0;
  await assert.rejects(listPosthogExperiments("https://us.posthog.com", "42", "test", (async () => ++calls === 1
    ? Response.json({ results: [{ id: 1 }], next: "?offset=100" }) : Response.json({ detail: "Unavailable" }, { status: 503 })) as typeof fetch), /Unavailable/);
  await assert.rejects(posthogJson("https://us.posthog.com", "test", (async () => new Response("not JSON")) as typeof fetch), /válida/);
});

test("PostHog sync preserves local fields, scopes all changes and keeps unlinked or other-project experiments", async () => {
  const existing = [item("linked", "experiment", { posthog_experiment_id: "101", metric: "Local KPI", hypothesis: "Local hypothesis" }),
    item("old", "experiment", { posthog_experiment_id: "3" }), item("manual"), { ...item("other", "experiment", { posthog_experiment_id: "4" }), project_id: "other-project" }];
  const mock = queuedClient([{ data: [{ id: "linked" }], error: null }, { data: null, error: null }, { data: [{ id: "old" }], error: null }]);
  const result = await syncPosthogExperiments(mock.client, item("p", "project"), "u", existing, [{ id: 101, name: "Remote name", metrics: [{ name: "Remote KPI" }] }, { id: 102, name: "New" }, { id: 102, name: "Duplicate" }]);
  assert.deepEqual(result, { created: 1, updated: 1, removed: 1 });
  assert.equal(mock.calls[0].payload.fields.hypothesis, "Local hypothesis");
  assert.equal(mock.calls[0].payload.fields.metric, "Local KPI");
  assert.deepEqual(mock.calls[0].filters, { workspace_id: "w", project_id: "p", id: "linked", updated_at: existing[0].updated_at });
  assert.equal(mock.calls[2].filters.id, "old");
  assert.equal(mock.calls[1].payload.fields.impact, 5);
});

test("sync rejects incomplete IDs and concurrent edits before deleting stale experiments", async () => {
  const malformed = queuedClient([]);
  await assert.rejects(syncPosthogExperiments(malformed.client, item("p", "project"), "u", [], [{ name: "No ID" }]));
  assert.equal(malformed.calls.length, 0);
  const conflict = queuedClient([{ data: [], error: null }]);
  await assert.rejects(syncPosthogExperiments(conflict.client, item("p", "project"), "u", [item("e", "experiment", { posthog_experiment_id: "1" }), item("old", "experiment", { posthog_experiment_id: "2" })], [{ id: 1 }]), /cambió/);
  assert.equal(conflict.calls.length, 1);
});

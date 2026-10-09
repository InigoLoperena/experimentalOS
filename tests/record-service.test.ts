import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteWorkspaceRecord, loadWorkspaceRecords, ensureProjectNorthStar, projectNorthStarRecord } from "../lib/record-service";
import { goalParent } from "../lib/model";
import { removeAttachment } from "../lib/attachment-service";
import type { Attachment } from "../lib/attachments";
import { item, queuedClient } from "./service-fixture";
import { openTeamSpace, getPublicPreview } from "../lib/internal-space";
import type { SupabaseClient } from "@supabase/supabase-js";

test("opening the app reads existing membership without creating a team; public previews hide attachment metadata", async () => {
  for (const rows of [[], [{ id: "w" }]]) {
    const mock = queuedClient([{ data: rows, error: null }]);
    assert.deepEqual(await openTeamSpace(mock.client), rows[0] || null);
    assert.equal(mock.calls[0].table, "workspaces");
  }
  const client = { rpc: async () => ({ data: { workspace: { id: "w" }, records: [], attachments: [{ storage_path: "private" }] }, error: null }) } as unknown as SupabaseClient;
  assert.deepEqual((await getPublicPreview(client))?.attachments, []);
});

test("workspace loading reads every row beyond the server cap with stable ordering and scope", async () => {
  const rows = Array.from({ length: 1201 }, (_, id) => item(String(id)));
  const mock = queuedClient(Array.from({ length: 13 }, (_, i) => ({ data: rows.slice(i * 100, i * 100 + 100), error: null, count: rows.length })));
  assert.deepEqual(await loadWorkspaceRecords(mock.client, "w"), rows);
  assert.ok(mock.calls.every(c => c.filters.workspace_id === "w" && c.orders.join(",") === "created_at,id"));
  assert.deepEqual(mock.calls.map(c => c.range![0]), Array.from({ length: 13 }, (_, i) => i * 100));
});

test("subgoals retain their goal parent and first goals use their project's North Star", () => {
  const ns = item("ns", "north_star"), goal = { ...item("g", "goal"), parent_id: "ns" };
  assert.equal(goalParent("g", [ns, goal]), "g");
  assert.equal(goalParent(null, [ns, goal]), "ns");
  assert.equal(goalParent(null, []), null);
  assert.equal(projectNorthStarRecord(item("p", "project", { north_star: "Compras semanales" })).project_id, "p");
  assert.throws(() => projectNorthStarRecord(item("p", "project")), /North Star/);
});

test("project-level North Stars are materialized once, including a concurrent creator", async () => {
  const project = item("p", "project", { north_star: "Compras" }), ns = item("ns", "north_star");
  const existing = queuedClient([{ data: ns, error: null }]);
  assert.equal((await ensureProjectNorthStar(existing.client, project)).id, "ns");
  assert.equal(existing.calls.length, 1);
  const fresh = queuedClient([{ data: null, error: null }, { data: ns, error: null }]);
  await ensureProjectNorthStar(fresh.client, project);
  assert.equal(fresh.calls[1].payload.kind, "north_star");
  assert.equal(fresh.calls[1].payload.project_id, "p");
  assert.equal(fresh.calls[1].payload.title, "Compras");
  assert.deepEqual(fresh.calls[0].filters, { workspace_id: "w", project_id: "p", kind: "north_star" });
  const race = queuedClient([{ data: null, error: null }, { data: null, error: { code: "23505", message: "Duplicate" } }, { data: ns, error: null }]);
  assert.equal((await ensureProjectNorthStar(race.client, project)).id, "ns");
});

test("record and project deletion use the records table and never remove files before authorization", async () => {
  const mock = queuedClient([{ data: null, error: null }, { data: [{ id: "p" }], error: null }]);
  await deleteWorkspaceRecord(mock.client, item("p", "project"));
  assert.deepEqual(mock.calls.map(c => c.table), ["records", "records"]);
  assert.deepEqual(mock.calls.map(c => c.filters), [{ workspace_id: "w", project_id: "p" }, { workspace_id: "w", id: "p" }]);
  assert.equal(mock.storageCalls(), 0);
  for (const response of [{ data: null, error: { message: "Foreign key violation" } }, { data: [], error: null }]) {
    const denied = queuedClient([response]);
    await assert.rejects(deleteWorkspaceRecord(denied.client, item("e")));
    assert.equal(denied.storageCalls(), 0);
  }
  const childrenDenied = queuedClient([{ data: null, error: { message: "Access denied" } }]);
  await assert.rejects(deleteWorkspaceRecord(childrenDenied.client, item("p", "project")), /Access denied/);
  assert.equal(childrenDenied.calls.length, 1);
});

test("denied attachment removal preserves its file; cleanup failure does not undo successful metadata removal", async () => {
  const attachment = { id: "a", record_id: "e", storage_path: "w/e/a.png" } as Attachment;
  const denied = queuedClient([{ data: [], error: null }]);
  await assert.rejects(removeAttachment(attachment, denied.client), /permiso/);
  assert.equal(denied.storageCalls(), 0);
  const deferred = queuedClient([{ data: [{ id: "a" }], error: null }, { data: null, error: { message: "Temporary failure" } }]);
  await removeAttachment(attachment, deferred.client);
  assert.deepEqual(deferred.calls[0].filters, { id: "a", record_id: "e" });
});

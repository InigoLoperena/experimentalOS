import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { linkSlots, type Attachment } from "../lib/attachments";
import { saveLinkSlot } from "../lib/attachment-service";

const record = { id: "record", workspace_id: "team" };
const link = (id: string, name: string): Attachment => ({ id, name, kind: "link", record_id: record.id, workspace_id: record.workspace_id, url: `https://example.org/${id}`, storage_path: null, mime_type: null, size: null });
test("link slots preserve empty positions and all legacy links, including duplicates and extras", () => {
  const legacy = [link("a", "Evidence"), link("b", "Dashboard"), link("c", "Research"), link("d", "More")];
  assert.deepEqual(linkSlots(legacy).slots, legacy.slice(0, 3));
  assert.deepEqual(linkSlots(legacy).extra, [legacy[3]]);
  const third = link("three", "Link 3"), duplicate = link("duplicate", "Link 3");
  const result = linkSlots([...legacy, third, duplicate]);
  assert.deepEqual(result.slots, [undefined, undefined, third]);
  assert.deepEqual(result.extra, [...legacy, duplicate]);
});

function fakeClient(insertError = false, deleteResult: "ok" | "error" | "denied" = "ok") {
  const calls: { action: string; payload?: Record<string, unknown>; filters: Record<string, unknown> }[] = [];
  const created = link("new", "Link 2");
  const client = { from(name: string) {
    assert.equal(name, "record_attachments");
    let current: typeof calls[number];
    return {
      insert(payload: Record<string, unknown>) { current = { action: "insert", payload, filters: {} }; calls.push(current); return this; },
      delete() { current = { action: "delete", filters: {} }; calls.push(current); return this; },
      eq(key: string, value: unknown) { current.filters[key] = value; return this; },
      single() { return Promise.resolve(insertError ? { data: null, error: { message: "Insert denied" } } : { data: created, error: null }); },
      select() { return current.action === "insert" ? this : Promise.resolve({ data: deleteResult === "ok" ? [{ id: "old" }] : [], error: deleteResult === "error" ? { message: "Delete failed" } : null }); },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: [], error: null }).then(resolve); },
    };
  } } as unknown as SupabaseClient;
  return { client, calls, created };
}
test("saving a replacement inserts first and scopes removal to the same record and link", async () => {
  const { client, calls, created } = fakeClient();
  assert.deepEqual(await saveLinkSlot(record, 1, "https://example.org/new", link("old", "Link 2"), client), created);
  assert.deepEqual(calls.map(c => c.action), ["insert", "delete"]);
  assert.deepEqual(calls[0].payload, { record_id: "record", workspace_id: "team", name: "Link 2", kind: "link", url: "https://example.org/new" });
  assert.deepEqual(calls[1].filters, { id: "old", record_id: "record", kind: "link" });
});
test("failed insertion leaves the old link untouched; failed removal rolls back only the replacement", async () => {
  const deniedInsert = fakeClient(true);
  await assert.rejects(saveLinkSlot(record, 1, "https://example.org/new", link("old", "Link 2"), deniedInsert.client), /Insert denied/);
  assert.deepEqual(deniedInsert.calls.map(c => c.action), ["insert"]);
  for (const result of ["error", "denied"] as const) {
    const failedDelete = fakeClient(false, result);
    await assert.rejects(saveLinkSlot(record, 1, "https://example.org/new", link("old", "Link 2"), failedDelete.client));
    assert.deepEqual(failedDelete.calls.map(c => c.action), ["insert", "delete", "delete"]);
    assert.deepEqual(failedDelete.calls[2].filters, { id: "new", record_id: "record" });
  }
});
test("empty links remove just their link; unsafe URLs never reach the database", async () => {
  const { client, calls } = fakeClient();
  assert.equal(await saveLinkSlot(record, 1, "", link("old", "Link 2"), client), undefined);
  assert.deepEqual(calls.map(c => c.action), ["delete"]);
  const invalid = fakeClient();
  await assert.rejects(saveLinkSlot(record, 0, "javascript:alert(1)", undefined, invalid.client), /válido/);
  assert.equal(invalid.calls.length, 0);
});

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "../lib/model";

export const item = (id: string, kind: Item["kind"] = "experiment", fields: Item["fields"] = {}): Item => ({
  id, kind, fields, workspace_id: "w", project_id: kind === "project" ? null : "p", parent_id: null,
  related_id: null, owner_id: "u", title: id, created_at: "2026-10-09", updated_at: "2026-10-09", created_by: "u", updated_by: "u",
});
export function queuedClient(responses: { data: any; error: any; count?: number }[]) {
  const calls: { table: string; action: string; payload?: any; filters: Record<string, unknown>; orders: string[]; range?: number[] }[] = [];
  let storageCalls = 0;
  const client = { from(table: string) {
    const call = { table, action: "read", filters: {}, orders: [] } as typeof calls[number]; calls.push(call);
    const finish = () => { const response = responses.shift(); if (!response) throw new Error("Unexpected database call"); return response; };
    return {
      select() { return this; }, order(key: string) { call.orders.push(key); return this; },
      eq(key: string, value: unknown) { call.filters[key] = value; return this; },
      in(key: string, value: unknown) { call.filters[key] = value; return this; },
      range(from: number, to: number) { call.range = [from, to]; return Promise.resolve(finish()); },
      insert(payload: unknown) { call.action = "insert"; call.payload = payload; return this; },
      update(payload: unknown) { call.action = "update"; call.payload = payload; return this; },
      delete() { call.action = "delete"; return this; },
      single() { return Promise.resolve(finish()); }, maybeSingle() { return Promise.resolve(finish()); },
      limit() { return this; }, then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return Promise.resolve().then(finish).then(resolve, reject); },
    };
  }, storage: { from() { storageCalls++; return { remove() { return Promise.resolve({ error: null }); } }; } } } as unknown as SupabaseClient;
  return { client, calls, storageCalls: () => storageCalls };
}

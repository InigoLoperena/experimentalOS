import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "./model";
import { readAllPages } from "./backup-service";

export function projectNorthStarRecord(project: Item): Item {
  const title = String(project.fields.north_star || "").trim();
  if (!title) throw new Error("Define primero la North Star Metric del proyecto.");
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), workspace_id: project.workspace_id, project_id: project.id,
    kind: "north_star", title, parent_id: null, related_id: null, owner_id: project.owner_id,
    fields: { metric: title, definition: title }, created_at: now, updated_at: now,
    created_by: null, updated_by: null };
}

export async function ensureProjectNorthStar(client: SupabaseClient, project: Item): Promise<Item> {
  const find = async () => {
    const result = await client.from("records").select("*").eq("workspace_id", project.workspace_id)
      .eq("project_id", project.id).eq("kind", "north_star").maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result.data as Item | null;
  };
  const existing = await find();
  if (existing) return existing;
  const record = projectNorthStarRecord(project);
  const { created_at, updated_at, created_by, updated_by, ...payload } = record;
  const inserted = await client.from("records").insert(payload).select("*").single();
  if (inserted.error?.code === "23505") {
    // Another editor may have created the project's unique North Star concurrently.
    const concurrent = await find();
    if (concurrent) return concurrent;
  }
  if (inserted.error) throw new Error(inserted.error.message);
  if (!inserted.data) throw new Error("No se pudo guardar la North Star del proyecto.");
  return inserted.data as Item;
}

export function loadWorkspaceRecords(client: SupabaseClient, workspaceId: string) {
  return readAllPages<Item>((from, to) => client.from("records")
    .select("*", { count: "exact" }).eq("workspace_id", workspaceId)
    .order("created_at").order("id").range(from, to));
}

export async function deleteWorkspaceRecord(client: SupabaseClient, record: Item) {
  if (record.kind === "project") {
    const children = await client.from("records").delete()
      .eq("workspace_id", record.workspace_id).eq("project_id", record.id);
    if (children.error) throw new Error(children.error.message);
  }
  // Attachment metadata cascades with the record. Its trigger queues file cleanup.
  // Never delete a file first: foreign keys or access policies can reject the record deletion.
  const result = await client.from("records").delete()
    .eq("workspace_id", record.workspace_id).eq("id", record.id).select("id");
  if (result.error) throw new Error(result.error.message);
  if (!result.data?.length) throw new Error("No tienes permiso para eliminar esta ficha o ya no existe. Actualiza los datos.");
}

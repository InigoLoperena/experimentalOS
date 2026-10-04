import type { SupabaseClient } from "@supabase/supabase-js";
import type { Backup } from "./backup";
import type { Attachment } from "./attachments";
import type { Item, Member } from "./model";

type Response<T> = { data: T[] | null; error: { message: string; code?: string } | null; count?: number | null };
export async function readAllPages<T>(page: (from: number, to: number) => PromiseLike<Response<T>>, size = 500): Promise<T[]> {
  const rows: T[] = []; let total: number | null = null;
  for (let from = 0; ;) {
    const result = await page(from, from + size - 1);
    if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code });
    if (!result.data) throw new Error("La descarga no ha devuelto datos. Inténtalo de nuevo.");
    if (from === 0) total = result.count ?? null;
    else if (total !== null && result.count != null && result.count !== total) throw new Error("Los datos han cambiado durante la descarga. Vuelve a exportar la copia.");
    rows.push(...result.data);
    if (total !== null ? rows.length >= total : result.data.length < size) break;
    if (!result.data.length) throw new Error("La copia está incompleta o los datos han cambiado. Vuelve a exportarla.");
    from += result.data.length;
  }
  if (total !== null && rows.length !== total) throw new Error("Los datos han cambiado durante la descarga. Vuelve a exportar la copia.");
  return rows;
}
export async function fetchBackup(client: SupabaseClient, workspaceId: string): Promise<Backup> {
  const notes: string[] = [];
  const table = <T>(name: string, select: string, order = "id") => readAllPages<T>((from, to) =>
    client.from(name).select(select, { count: "exact" }).eq("workspace_id", workspaceId).order(order).range(from, to) as unknown as PromiseLike<Response<T>>);
  const [records, rawMembers, audit, attachments] = await Promise.all([
    table<Item>("records", "*"),
    table<Member & { profiles: { name: string; avatar_url?: string | null } | null }>("members", "*,profiles(*)", "user_id"),
    table<Record<string, unknown>>("audit_log", "*"),
    table<Attachment>("record_attachments", "*").catch(err => {
      if (!["42P01", "PGRST205"].includes(err.code)) throw err;
      notes.push("Los adjuntos no están activados en esta instalación."); return [];
    }),
  ]);
  const ids = new Set(records.map(r => r.id));
  return { schema_version: 4, exported_at: new Date().toISOString(), workspace_id: workspaceId, records,
    members: rawMembers.map(m => ({ ...m, name: m.profiles?.name || "Miembro", avatar_url: m.profiles?.avatar_url || null })),
    audit, attachments: attachments.filter(a => ids.has(a.record_id)), notes };
}

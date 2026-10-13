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
  const [records, rawMembers, audit, attachments, comments, specs, variants, resources, observations, preparations, runs, steps, connections, knowledge, googlePreparations, smartleadPreparations, chats, usage] = await Promise.all([
    table<Item>("records", "*"),
    table<Member & { profiles: { name: string; avatar_url?: string | null } | null }>("members", "*,profiles(*)", "user_id"),
    table<Record<string, unknown>>("audit_log", "*"),
    table<Attachment>("record_attachments", "*").catch(err => {
      if (!["42P01", "PGRST205"].includes(err.code)) throw err;
      notes.push("Los adjuntos no están activados en esta instalación."); return [];
    }),
    table<Record<string, unknown>>("record_comments", "*").catch(err => {
      if (!["42P01", "PGRST205"].includes(err.code)) throw err;
      notes.push("Los comentarios no están activados en esta instalación."); return [];
    }),
    table<Record<string, unknown>>("experiment_specs", "*", "experiment_id"),
    table<Record<string, unknown>>("experiment_variants", "*"),
    table<Record<string, unknown>>("external_resources", "*"),
    table<Record<string, unknown>>("metric_observations", "*"),
    table<Record<string, unknown>>("meta_campaign_preparations", "*", "experiment_id"),
    table<Record<string, unknown>>("meta_preparation_runs", "*"),
    table<Record<string, unknown>>("meta_preparation_steps", "*", "request_id"),
    table<Record<string, unknown>>("integration_connections", "*"),
    table<Record<string, unknown>>("ai_knowledge", "*").catch(err=>{
      if(!["42P01","PGRST205"].includes(err.code))throw err;
      notes.push("La memoria importada de IA no está activada en esta instalación.");return [];
    }),
    table<Record<string, unknown>>("google_ads_preparations", "*", "experiment_id"),
    table<Record<string, unknown>>("smartlead_preparations", "*", "experiment_id"),
    // Chat RLS exposes only the exporting user's conversations, even for an owner.
    table<Record<string, unknown>>("ai_chat_entries", "*"),
    table<Record<string, unknown>>("ai_preparation_usage", "*", "request_id"),
  ]);
  const ids = new Set(records.map(r => r.id));
  notes.push("Las claves y tokens de integraciones no se exportan; configura los secretos por separado al restaurar.");
  notes.push("Las conversaciones privadas de IA incluyen únicamente las del usuario que exporta; las conversaciones de otros miembros permanecen privadas.");
  return { schema_version: 7, exported_at: new Date().toISOString(), workspace_id: workspaceId, records,
    members: rawMembers.map(m => ({ ...m, name: m.profiles?.name || "Miembro", avatar_url: m.profiles?.avatar_url || null })),
    audit, attachments: attachments.filter(a => ids.has(a.record_id)), comments: comments.filter(c => ids.has(String(c.record_id))), notes,
    monitoring: { experiment_specs: specs, experiment_variants: variants, external_resources: resources, metric_observations: observations,
      meta_campaign_preparations: preparations, meta_preparation_runs: runs, meta_preparation_steps: steps, integration_connections: connections, ai_knowledge:knowledge,
      google_ads_preparations:googlePreparations,smartlead_preparations:smartleadPreparations,ai_chat_entries:chats,ai_preparation_usage:usage } };
}

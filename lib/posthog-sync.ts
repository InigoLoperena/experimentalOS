import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "./model";

export type PostHogExperiment = Record<string, any>;
export const posthogId = (experiment: PostHogExperiment) => String(experiment.id ?? experiment.pk ?? experiment.uuid ?? "").trim();
export const posthogName = (experiment: PostHogExperiment) => String(experiment.name ?? experiment.title ?? experiment.feature_flag?.name ?? "Experimento de PostHog");
export function posthogMetric(experiment: PostHogExperiment) {
  const metric = experiment.metrics?.[0] ?? experiment.primary_metrics?.[0];
  return String(metric?.name ?? metric?.metric_name ?? metric?.event ?? experiment.description ?? "");
}
export function posthogStatus(experiment: PostHogExperiment) {
  if (experiment.archived) return "Archivado";
  if (experiment.end_date) return "Finalizado";
  if (experiment.start_date) return "En curso";
  return String(experiment.status ?? experiment.state ?? "Borrador");
}

export async function syncPosthogExperiments(client: SupabaseClient, project: Item, userId: string, existing: Item[], remote: PostHogExperiment[]) {
  if (remote.some(experiment => !posthogId(experiment))) throw new Error("La lista de PostHog está incompleta. No se sincronizaron datos.");
  const local = existing.filter(item => item.kind === "experiment" && item.workspace_id === project.workspace_id && item.project_id === project.id);
  const counts = { created: 0, updated: 0, removed: 0 };
  const seen = new Set<string>();
  for (const experiment of remote) {
    const id = posthogId(experiment);
    if (seen.has(id)) continue;
    seen.add(id);
    const record = local.find(item => String(item.fields.posthog_experiment_id || "").trim() === id);
    const fields = { ...(record?.fields || {}), posthog_experiment_id: id,
      metric: record?.fields.metric || posthogMetric(experiment), context: record?.fields.context || String(experiment.description || "") };
    const payload = { title: posthogName(experiment), fields, updated_by: userId };
    if (record) {
      const result = await client.from("records").update(payload).eq("workspace_id", project.workspace_id)
        .eq("project_id", project.id).eq("id", record.id).eq("updated_at", record.updated_at).select("id");
      if (result.error) throw new Error(result.error.message);
      if (!result.data?.length) throw new Error("Un experimento cambió durante la sincronización. Actualiza los datos e inténtalo de nuevo.");
      counts.updated++;
    } else {
      const result = await client.from("records").insert({ ...payload, id: crypto.randomUUID(), workspace_id: project.workspace_id,
        project_id: project.id, kind: "experiment", parent_id: null, related_id: null, owner_id: userId,
        fields: { ...fields, impact: 5, confidence: 5, ease: 5 }, created_by: userId });
      if (result.error) throw new Error(result.error.message);
      counts.created++;
    }
  }
  for (const record of local) {
    const id = String(record.fields.posthog_experiment_id || "").trim();
    if (!id || seen.has(id)) continue;
    const result = await client.from("records").delete().eq("workspace_id", project.workspace_id)
      .eq("project_id", project.id).eq("id", record.id).eq("updated_at", record.updated_at).select("id");
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.length) throw new Error("Un experimento cambió durante la sincronización. Actualiza los datos e inténtalo de nuevo.");
    counts.removed++;
  }
  return counts;
}

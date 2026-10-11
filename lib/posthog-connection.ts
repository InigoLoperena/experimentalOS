import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "./model";
import { posthogHost, posthogIdentifier, PostHogError } from "./posthog-api";

export async function verifiedPosthogConnection(client: SupabaseClient, project: Item, allowedHosts = "") {
  const { data, error } = await client.from("posthog_project_bindings")
    .select("external_project_id,host,credential_ref")
    .eq("workspace_id", project.workspace_id).eq("project_id", project.id).maybeSingle();
  if (error) throw new PostHogError("No se pudo verificar la conexión de PostHog. Actualiza la configuración del servidor.", 503);
  if (!data || data.credential_ref !== "legacy_posthog_server")
    throw new PostHogError("Este proyecto necesita una conexión de PostHog autorizada por el administrador.", 403);
  const host = posthogHost(String(data.host), allowedHosts);
  const projectId = String(data.external_project_id);
  posthogIdentifier(projectId);
  if (String(project.fields.posthog_project_id || "").trim() !== projectId ||
      posthogHost(String(project.fields.posthog_host || ""), allowedHosts) !== host)
    throw new PostHogError("Los datos de PostHog cambiaron. El administrador debe verificar la nueva conexión antes de utilizarla.", 409);
  return { host, projectId };
}

import { NextRequest, NextResponse } from "next/server";
import { listPosthogExperiments, posthogIdentifier, posthogJson, PostHogError } from "@/lib/posthog-api";
import { ApiError, authenticatedClient, authorizedProject } from "@/lib/server-access";
import { verifiedPosthogConnection } from "@/lib/posthog-connection";

export async function POST(request: NextRequest) {
  try {
    const { client: supabase } = await authenticatedClient(request);
    const posthogKey = process.env.POSTHOG_PERSONAL_API_KEY;

    if (!posthogKey) {
      return NextResponse.json({ error: "Falta POSTHOG_PERSONAL_API_KEY en las variables del servidor." }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
    const projectId = String(body.project_id || "");
    const experimentId = String(body.experiment_id || "");
    if (!projectId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

    const project = await authorizedProject(supabase, projectId);
    const { projectId: externalProjectId, host } = await verifiedPosthogConnection(supabase, project, process.env.POSTHOG_ALLOWED_HOSTS);

    const base = `${host}/api/projects/${posthogIdentifier(externalProjectId)}/experiments`;

    if (!experimentId) {
      const payload = await listPosthogExperiments(host, externalProjectId, posthogKey);
      return NextResponse.json({ host, project_id: externalProjectId, experiments: payload });
    }

    const externalExperimentId = posthogIdentifier(experimentId);
    const detail = await posthogJson(`${base}/${externalExperimentId}/`, posthogKey);
    let results = null, resultsError: string | null = null;
    try { results = await posthogJson(`${base}/${externalExperimentId}/results/`, posthogKey); }
    catch (error) { resultsError = error instanceof Error ? error.message : "PostHog no devolvió resultados."; }

    return NextResponse.json({
      host,
      project_id: externalProjectId,
      detail,
      results,
      results_error: resultsError,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error inesperado al consultar PostHog." },
      { status: error instanceof PostHogError || error instanceof ApiError ? error.status : 502,
        headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

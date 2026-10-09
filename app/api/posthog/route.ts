import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listPosthogExperiments, posthogHost, posthogIdentifier, posthogJson, PostHogError } from "@/lib/posthog-api";

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const posthogKey = process.env.POSTHOG_PERSONAL_API_KEY;
    if (!url || !anon) {
      return NextResponse.json({ error: "Supabase no está configurado en el servidor." }, { status: 500 });
    }
    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
    }

    if (!posthogKey) {
      return NextResponse.json({ error: "Falta POSTHOG_PERSONAL_API_KEY en las variables del servidor." }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
    const projectId = String(body.project_id || "");
    const experimentId = String(body.experiment_id || "");
    if (!projectId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

    const { data: project, error: projectError } = await supabase
      .from("records")
      .select("id,kind,fields")
      .eq("id", projectId)
      .eq("kind", "project")
      .single();
    if (projectError || !project) {
      return NextResponse.json({ error: "No tienes acceso a ese proyecto." }, { status: 403 });
    }

    const externalProjectId = String(project.fields?.posthog_project_id || "").trim();
    const host = posthogHost(String(project.fields?.posthog_host || "https://us.posthog.com"), process.env.POSTHOG_ALLOWED_HOSTS);
    if (!externalProjectId) {
      return NextResponse.json(
        { error: "Configura el ID del proyecto de PostHog en la ficha del proyecto." },
        { status: 400 },
      );
    }

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
      { status: error instanceof PostHogError ? error.status : 502 },
    );
  }
}

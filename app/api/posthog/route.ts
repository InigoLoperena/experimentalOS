import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function cleanHost(value: string) {
  const raw = value.trim().replace(/\/+$/, "");
  if (!raw) return "https://us.posthog.com";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

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
    if (!posthogKey) {
      return NextResponse.json(
        { error: "Falta POSTHOG_PERSONAL_API_KEY en las variables de entorno de Vercel." },
        { status: 503 },
      );
    }

    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
    }

    const body = await request.json();
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
    const host = cleanHost(String(project.fields?.posthog_host || "https://us.posthog.com"));
    if (!externalProjectId) {
      return NextResponse.json(
        { error: "Configura el ID del proyecto de PostHog en la ficha del proyecto." },
        { status: 400 },
      );
    }

    const headers = {
      Authorization: `Bearer ${posthogKey}`,
      "Content-Type": "application/json",
    };
    const base = `${host}/api/projects/${encodeURIComponent(externalProjectId)}/experiments`;

    if (!experimentId) {
      const response = await fetch(`${base}/?limit=100`, { headers, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return NextResponse.json(
          { error: payload?.detail || payload?.error || "PostHog ha rechazado la consulta." },
          { status: response.status },
        );
      }
      return NextResponse.json({ host, project_id: externalProjectId, experiments: payload });
    }

    const detailResponse = await fetch(`${base}/${encodeURIComponent(experimentId)}/`, {
      headers,
      cache: "no-store",
    });
    const detail = await detailResponse.json().catch(() => ({}));
    if (!detailResponse.ok) {
      return NextResponse.json(
        { error: detail?.detail || detail?.error || "No se ha encontrado el experimento en PostHog." },
        { status: detailResponse.status },
      );
    }

    const resultsResponse = await fetch(
      `${base}/${encodeURIComponent(experimentId)}/results/`,
      { headers, cache: "no-store" },
    );
    const results = await resultsResponse.json().catch(() => null);

    return NextResponse.json({
      host,
      project_id: externalProjectId,
      detail,
      results: resultsResponse.ok ? results : null,
      results_error: resultsResponse.ok
        ? null
        : results?.detail || results?.error || "PostHog no devolvió resultados para este experimento.",
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error inesperado al consultar PostHog." },
      { status: 500 },
    );
  }
}

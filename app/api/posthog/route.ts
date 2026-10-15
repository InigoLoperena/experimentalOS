import { NextRequest, NextResponse } from "next/server";
import {readJsonBody} from '@/lib/request-body';
import { listPosthogExperiments, posthogIdentifier, posthogJson, PostHogError } from "@/lib/posthog-api";
import { ApiError, authenticatedClient, authorizedProject } from "@/lib/server-access";
import { resolvedPosthog } from "@/lib/integration-service";
import {persistProviderResult} from '@/lib/provider-result-memory';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};

export async function POST(request: NextRequest) {
  try {
    const { client: supabase } = await authenticatedClient(request);
    const body = await readJsonBody(request,5000);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400,headers });
    const projectId = String(body.project_id || "");
    const experimentId = String(body.experiment_id || "");
    if (!projectId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400,headers });

    const project = await authorizedProject(supabase, projectId);
    const { projectId: externalProjectId, host, key: posthogKey } = await resolvedPosthog(supabase, project);

    const base = `${host}/api/projects/${posthogIdentifier(externalProjectId)}/experiments`;

    if (!experimentId) {
      const payload = await listPosthogExperiments(host, externalProjectId, posthogKey);
      return NextResponse.json({ host, project_id: externalProjectId, experiments: payload },{headers});
    }

    const externalExperimentId = posthogIdentifier(experimentId);
    const detail = await posthogJson(`${base}/${externalExperimentId}/`, posthogKey);
    let results = null, resultsError: string | null = null;
    if(!detail.start_date){resultsError='El experimento está en borrador. Los resultados aparecerán cuando se active y reciba exposiciones y eventos.';}
    else try {
      // Read cached calculations only: refreshing a card must not repeatedly trigger paid queries.
      results=await posthogJson(`${base}/${externalExperimentId}/metrics_recalculation/latest/`,posthogKey);
    }catch(error){
      if(error instanceof PostHogError&&error.status===404){
        try{results=await posthogJson(`${base}/${externalExperimentId}/results/`,posthogKey);}
        catch{resultsError='Todavía no hay resultados calculados disponibles. Revisa el análisis en PostHog y vuelve a consultar.';}
      }else resultsError=error instanceof Error?error.message:'PostHog no devolvió resultados.';
    }

    let storage;
    const linked=await supabase.from('external_resources').select('*').eq('workspace_id',project.workspace_id).eq('project_id',project.id).eq('provider','posthog').eq('resource_type','experiment').eq('external_id',externalExperimentId);
    if(linked.error)throw new ApiError('No se pudo comprobar el vínculo de PostHog.',503);
    for(const resource of linked.data||[])storage=await persistProviderResult(supabase,resource,{name:detail.name,start_date:detail.start_date||null,end_date:detail.end_date||null,results,results_error:resultsError},[],detail.start_date?String(detail.start_date).slice(0,10):null,detail.end_date?String(detail.end_date).slice(0,10):null);
    return NextResponse.json({
      host,
      project_id: externalProjectId,
      detail,
      results,
      results_error: resultsError,
      updated_at: new Date().toISOString(),
      storage,
    },{headers});
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error inesperado al consultar PostHog." },
      { status: error instanceof PostHogError || error instanceof ApiError ? error.status : 502,
        headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

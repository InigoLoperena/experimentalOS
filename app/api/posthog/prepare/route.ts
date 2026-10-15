import {NextResponse} from 'next/server';
import {authenticatedClient,authorizedProject,ApiError} from '@/lib/server-access';
import {resolvedPosthog} from '@/lib/integration-service';
import {readJsonBody} from '@/lib/request-body';
import {posthogHost,posthogIdentifier,posthogJson,PostHogError,listPosthogExperiments} from '@/lib/posthog-api';
import {posthogRecipe,posthogDigest,posthogWrite,posthogFlagKey,verifiedPosthogDraft,PosthogWriteError} from '@/lib/posthog-build';
import type {Item} from '@/lib/model';
export const runtime='nodejs';export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
const uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
export async function POST(request:Request){
 let externalId:string|null=null,jobId:string|null=null,client:Awaited<ReturnType<typeof authenticatedClient>>['client']|null=null;
 try{
  const auth=await authenticatedClient(request);client=auth.client;
  const body=await readJsonBody(request,5000);
  if(!uuid(body.experiment_id)||!['status','review','create'].includes(body.action))throw new ApiError('Selecciona un experimento válido.',400);
  const project=await authorizedProject(client,body.project_id);
  const result=await client.from('records').select('*').eq('id',body.experiment_id).eq('workspace_id',project.workspace_id).eq('project_id',project.id).eq('kind','experiment').single();
  if(result.error||!result.data)throw new ApiError('No tienes acceso al experimento.',403);
  const experiment=result.data as Item;
  const permission=await client.rpc('can_record_action',{w:project.workspace_id,k:'experiment',a:'edit'}),editable=!permission.error&&permission.data===true;
  const connection=await resolvedPosthog(client,project);connection.host=posthogHost(connection.host);posthogIdentifier(connection.projectId);
  const jobs=await client.from('posthog_preparations').select('*').eq('workspace_id',project.workspace_id).eq('project_id',project.id).eq('experiment_id',experiment.id).order('created_at',{ascending:false}).limit(1);
  if(jobs.error)throw new ApiError('Actualiza la preparación de PostHog en Supabase antes de enviar.',503);
  const job=jobs.data?.[0];
  if(job&&(job.host!==connection.host||job.external_project_id!==connection.projectId)&&job.status!=='rejected')throw new ApiError('La conexión de PostHog ha cambiado desde el envío. Restaura el perfil del proyecto para consultar ese recurso.',409);
  let linked=String(experiment.fields.posthog_experiment_id||job?.external_id||'');
  if(body.action==='status'){
   let detail=null;
   if(linked)detail=await posthogJson(`${connection.host}/api/projects/${posthogIdentifier(connection.projectId)}/experiments/${posthogIdentifier(linked)}/`,connection.key);
   // Recover a timed-out response by its deterministic flag key; never repeat the POST.
   else if(body.refresh===true&&job&&['pending','uncertain'].includes(job.status)){
    const remote=await listPosthogExperiments(connection.host,connection.projectId,connection.key);
    detail=remote.results.find((row:any)=>(row.feature_flag_key||row.feature_flag?.key)===job.flag_key)||null;
    if(detail&&editable&&job.created_by===auth.user.id){
     const saved=await client.rpc('finish_posthog',{p_id:job.id,p_status:'succeeded',p_external:String(detail.id)});
     if(saved.error)throw new ApiError('Recurso localizado en PostHog, pero no se pudo guardar el vínculo. No repitas el envío.',409);
     linked=String(detail.id);
    }
   }
    const latest=body.refresh===true?await client.from('records').select('*').eq('id',experiment.id).eq('workspace_id',project.workspace_id).eq('project_id',project.id).single():null;
    return NextResponse.json({record:latest?.data||undefined,id:detail?.id?String(detail.id):linked||null,name:detail?.name||`Experimento · ${experiment.title}`,status:detail?.archived?'Archivado':detail?.end_date?'Finalizado':detail?.start_date?(detail.feature_flag?.active===false?'Pausado':'En curso'):detail?'Borrador':null,url:(detail?.id||linked)?`${connection.host}/project/${posthogIdentifier(connection.projectId)}/experiments/${posthogIdentifier(String(detail?.id||linked))}`:null,flag_key:detail?.feature_flag_key||null,pending:!detail&&!!job&&['pending','uncertain'].includes(job.status)},{headers});
  }
  if(!editable)throw new ApiError('Necesitas permiso para editar experimentos.',403);
  if(linked||job&&job.status!=='rejected')throw new ApiError('Ya existe un envío de este experimento. Actualiza su estado para consultar el vínculo.',409);
  const recipe=await posthogRecipe(experiment,connection);
  const fingerprint=posthogDigest({revision:experiment.updated_at,host:connection.host,project:connection.projectId,payload:recipe.payload});
  if(body.action==='review')return NextResponse.json({fingerprint,notes:recipe.notes},{headers});
  if(!uuid(body.request_id)||body.confirmed!==true||body.fingerprint!==fingerprint)throw new ApiError('La propuesta ha cambiado. Revisa de nuevo antes de enviar.',409);
  const reserved=await client.rpc('reserve_posthog',{p_id:body.request_id,p_experiment:experiment.id,p_fingerprint:fingerprint,p_revision:experiment.updated_at,p_host:connection.host,p_project:connection.projectId});
  if(reserved.error)throw new ApiError('El envío está guardado, cambió la ficha o hay otro pendiente. Actualiza su estado antes de repetir.',409);
  jobId=body.request_id;
  const created=await posthogWrite(connection,recipe.payload);
  verifiedPosthogDraft(created,posthogFlagKey(experiment.id));
  externalId=String(created.id);
  const detail=await posthogJson(`${connection.host}/api/projects/${posthogIdentifier(connection.projectId)}/experiments/${posthogIdentifier(externalId!)}/`,connection.key);
  verifiedPosthogDraft(detail,recipe.payload.feature_flag_key);
  const saved=await client.rpc('finish_posthog',{p_id:jobId,p_status:'succeeded',p_external:externalId});
  if(saved.error)throw new ApiError(`Borrador creado en PostHog (ID ${externalId}), pero no se guardó el vínculo. Actualiza el estado; no repitas el envío.`,409);
  jobId=null;
  const latest=await client.from('records').select('*').eq('id',experiment.id).eq('workspace_id',project.workspace_id).eq('project_id',project.id).single();
  return NextResponse.json({record:latest.data||undefined,id:externalId,name:detail.name,status:'Borrador',url:`${connection.host}/project/${posthogIdentifier(connection.projectId)}/experiments/${externalId}`,flag_key:recipe.payload.feature_flag_key,notes:recipe.notes,pending:false},{headers});
 }catch(error){
  if(client&&jobId)await client.rpc('finish_posthog',{p_id:jobId,p_status:error instanceof PosthogWriteError&&!error.uncertain&&!externalId?'rejected':'uncertain',p_external:externalId});
  return NextResponse.json({error:error instanceof ApiError||error instanceof PostHogError?error.message:'No se pudo confirmar el envío a PostHog. Actualiza el estado antes de repetir.',id:externalId},{status:error instanceof ApiError||error instanceof PostHogError?error.status:502,headers});
 }
}

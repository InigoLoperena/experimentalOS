import {NextResponse} from 'next/server';
import {readJsonBody} from '@/lib/request-body';
import {authenticatedClient,authorizedProject,ApiError} from '@/lib/server-access';
import {resolvedMetaConnection} from '@/lib/integration-service';
import {metaAccount,metaId,metaJson} from '@/lib/meta-ads';
import {buildMetaRecipe,parseMetaSelection,digest,nextMetaStep,type MetaStepResult,type MetaSelection} from '@/lib/meta-build';
import {privateMetaFile,renderMetaImage} from '@/lib/meta-media';
import {writeMetaStep,metaVideoReady} from '@/lib/meta-write';
import {MetaCreationError} from '@/lib/meta-preparation';
import {metaDraftDefaults} from '@/lib/meta-draft-defaults';
import type {Item} from '@/lib/model';
import type {Attachment} from '@/lib/attachments';
import type {Variant} from '@/lib/monitoring';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
const uuid=(id:unknown)=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id);
export async function POST(request:Request){
 const startedAt=Date.now();
 try{
  const {client}=await authenticatedClient(request);
  const body=await readJsonBody(request,30000);
  if(!body||!uuid(body.experiment_id)||!uuid(body.project_id)||!['context','review','begin','step','preview'].includes(body.action))throw new ApiError('Selecciona un experimento válido.',400);
  const project=await authorizedProject(client,body.project_id);
  const permission=await client.rpc('can_record_action',{w:project.workspace_id,k:'experiment',a:'edit'});
  if(permission.error||!permission.data)throw new ApiError('Necesitas permiso para editar experimentos.',403);
  const record=await client.from('records').select('*').eq('id',body.experiment_id).eq('project_id',project.id).eq('kind','experiment').single();
  if(record.error||!record.data)throw new ApiError('No tienes acceso al experimento.',403);
  const experiment=record.data as Item;
  const attachmentsResult=await client.from('record_attachments').select('*').eq('record_id',experiment.id).eq('workspace_id',project.workspace_id);
  if(attachmentsResult.error)throw new ApiError('No se pudieron consultar los materiales.',503);
  const attachments=attachmentsResult.data as Attachment[];
  if(body.action==='context'){
   const runs=await client.from('meta_preparation_runs').select('id,selection,created_at').eq('experiment_id',experiment.id).order('created_at',{ascending:false}).limit(20);
   if(runs.error)throw new ApiError('Falta activar la preparación completa en Supabase.',503);
   const campaigns=await client.from('external_resources').select('external_id,label').eq('experiment_id',experiment.id).eq('workspace_id',project.workspace_id).eq('provider','meta_ads').eq('resource_type','campaign').not('external_id','is',null);
   if(campaigns.error)throw new ApiError('No se pudieron comprobar las campañas anteriores.',503);
   return NextResponse.json({attachments,runs:runs.data,campaigns:campaigns.data},{headers});
  }
  // Cropped preview uses private Storage under the requesting user's JWT, no external URL input.
  if(body.action==='preview'){
   const a=attachments.find(row=>row.id===body.attachment_id&&row.kind==='image');
   if(!a||!['feed','story','reels'].includes(body.placement)||!['centre','attention','north','south'].includes(body.crop))throw new ApiError('Selecciona imagen y formato válidos.',400);
   const rendered=await renderMetaImage(await privateMetaFile(client,a),{key:'preview',kind:'image',label:a.name,variant_id:null,placement:body.placement,crop:body.crop});
   return NextResponse.json({preview:rendered.preview,width:rendered.width,height:rendered.height,hash:rendered.hash,upscaled:rendered.upscaled},{headers});
  }
  let savedRun:{id:string;selection:MetaSelection&{approved_images:Record<string,string>};fingerprint:string}|null=null;
  if(body.action==='step'){
   if(!uuid(body.run_id))throw new ApiError('Selecciona la preparación guardada.',400);
   const run=await client.from('meta_preparation_runs').select('*').eq('id',body.run_id).eq('experiment_id',experiment.id).single();
   if(run.error||!run.data)throw new ApiError('No tienes acceso a esta preparación.',403);savedRun=run.data;
  }
  let selection=parseMetaSelection(savedRun?savedRun.selection:{...body.selection,name_mode:'experiment'});
  const spec=await client.from('experiment_specs').select('code').eq('experiment_id',experiment.id).single();
  const variants=await client.from('experiment_variants').select('*').eq('experiment_id',experiment.id);
  if(spec.error||variants.error)throw new ApiError('Guarda el experimento y sus variantes antes de continuar.',400);
  const connection=await resolvedMetaConnection(client,project);
  const account=await metaAccount(connection);
  const defaults=metaDraftDefaults(experiment,project,selection,{...connection,currency:account.currency});selection=defaults.selection;
  const recipe=buildMetaRecipe(defaults.experiment,spec.data.code,selection,attachments,variants.data as Variant[],{...connection,currency:account.currency},savedRun?0:Date.now());if(!account.active)throw new ApiError('La cuenta de Meta no está activa.',400);
  if(account.currency!==recipe.currency)throw new ApiError(`La cuenta utiliza ${account.currency}. Guarda el presupuesto de la ficha en esa moneda antes de preparar Meta.`,400);
  // Parent identity/status/objective verified against the configured account on every request.
  if(selection.mode!=='campaign'){
   const parent=await metaJson(metaId(selection.parent_id),{fields:selection.mode==='ad'?'id,account_id,status,campaign_id,targeting':'id,account_id,status,objective'},connection.token);
   if(parent.account_id!==connection.accountId||parent.status!=='PAUSED')throw new ApiError('El recurso padre debe pertenecer a esta cuenta y estar pausado.',400);
   const campaign=selection.mode==='ad'?await metaJson(metaId(parent.campaign_id),{fields:'id,account_id,status,objective'},connection.token):parent;
   if(campaign.account_id!==connection.accountId||campaign.status!=='PAUSED'||campaign.objective!==recipe.objective)throw new ApiError('El objetivo o estado de la campaña padre no coincide con esta preparación.',400);
   if(selection.mode==='ad'){
    const target=parent.targeting as {facebook_positions?:string[];instagram_positions?:string[]};
    const placement=selection.meta.placements[0],fb=placement==='feed'?'feed':placement==='story'?'story':'facebook_reels',ig=placement==='feed'?'stream':placement==='story'?'story':'reels';
    if(target?.facebook_positions?.length!==1||target.facebook_positions[0]!==fb||target.instagram_positions?.length!==1||target.instagram_positions[0]!==ig)throw new ApiError('El conjunto debe limitarse a la ubicación y plataformas elegidas; revisa su segmentación en Meta.',400);
   }
  }
  if(recipe.pixel){
   const pixels=await metaJson(`act_${connection.accountId}/adspixels`,{fields:'id',limit:'100'},connection.token);
   if(!Array.isArray(pixels.data)||!pixels.data.some((p:{id:string})=>p.id===recipe.pixel))throw new ApiError('El píxel configurado no está accesible en esta cuenta. Verifica permisos y evento en Events Manager.',400);
  }
  const rows= savedRun ? await client.from('meta_preparation_steps').select('*').eq('run_id',savedRun.id) : null;
  if(rows?.error)throw new ApiError('No se pudo comprobar el avance anterior. No se enviaron cambios.',503);
  const approved:Record<string,string>=savedRun?.selection.approved_images||{};
  const previews=[];
  if(!savedRun){
   for(const step of recipe.steps.filter(s=>['image','thumbnail'].includes(s.kind))){
    const rendered=await renderMetaImage(await privateMetaFile(client,step.attachment!),step);
    approved[step.key]=rendered.hash;previews.push({key:step.key,label:step.label,preview:rendered.preview,width:rendered.width,height:rendered.height,upscaled:rendered.upscaled});
   }
  }
  const fingerprint=digest({recipe,approved});
  if(savedRun&&savedRun.fingerprint!==fingerprint)throw new ApiError('La ficha, materiales o integración cambiaron. Revisa una preparación nueva antes de continuar.',409);
  if(body.action==='review')return NextResponse.json({fingerprint,account,name:recipe.name,objective:recipe.objective,optimization:recipe.optimization,currency:recipe.currency,total:recipe.total/100,budget_period:recipe.budget_period||'total',start:recipe.start,end:recipe.end,steps:recipe.steps.map(({attachment,...s})=>({...s,attachment_name:attachment?.name})),previews,write_available:!!connection.writeToken,selection,notes:defaults.notes},{headers});
  if(!connection.writeToken)throw new ApiError('Configura el token ads_management en Integraciones.',400);
  if(body.action==='begin'){
   if(body.confirmed!==true||body.fingerprint!==fingerprint||!uuid(body.request_id))throw new ApiError('Revisa y aprueba esta configuración y sus recortes.',409);
   const started=await client.rpc('begin_meta_run',{p_id:body.request_id,p_experiment:experiment.id,p_fingerprint:fingerprint,p_revision:experiment.updated_at,p_selection:{...selection,approved_images:approved}});
   if(started.error)throw new ApiError(started.error.message,409);
   return NextResponse.json({run_id:started.data},{headers});
  }
  const next=nextMetaStep(recipe,rows!.data||[]);
  if(!next.step)return NextResponse.json({done:true,rows:rows!.data},{headers});
  if(next.blocked)throw new ApiError('Hay un paso pendiente o sin confirmar. No se repetirá: revisa Ads Manager y los IDs guardados.',409);
  const step=next.step;
  const media=step.kind==='creative'?recipe.steps.find(s=>s.key===step.key.replace(/_creative$/,'_media')):null;
  if(media?.kind==='video'&&!await metaVideoReady(connection,next.results[media.key].id!))return NextResponse.json({waiting:true,message:'Meta está procesando el vídeo. Pulsa continuar dentro de unos minutos.',rows:rows!.data},{headers});
  let file:Buffer|undefined;
  if(step.attachment){
   const input=await privateMetaFile(client,step.attachment);
   if(step.kind==='video')file=input;
   else{const rendered=await renderMetaImage(input,step);if(rendered.hash!==approved[step.key])throw new ApiError('La imagen cambió desde la aprobación. Revisa de nuevo.',409);file=rendered.bytes;}
  }
  if(Date.now()-startedAt>20000)throw new ApiError('La revisión de este paso tardó demasiado. No se enviaron cambios a Meta; vuelve a continuar.',503);
  const requestId=crypto.randomUUID();
  const reserved=await client.rpc('reserve_meta_step',{p_run:savedRun!.id,p_step:step.key,p_request:requestId});if(reserved.error)throw new ApiError(reserved.error.message,409);
  let result:MetaStepResult;
  try{result=await writeMetaStep({...connection,token:connection.writeToken},recipe,step,next.results,file);}
  catch(error){
   const status=error instanceof MetaCreationError&&error.uncertain?'uncertain':'rejected';
   const diagnostic=error instanceof MetaCreationError?error.diagnostic:undefined;
   const finish=await client.rpc('finish_meta_step',{p_request:requestId,p_status:status,p_result:diagnostic?{error:diagnostic}:{}});
   if(finish.error)throw new ApiError('No se pudo guardar el resultado. Revisa Meta antes de repetir.',502);throw error;
  }
  const type=['campaign','adset','ad'].includes(step.kind)?step.kind:null;
  const finish=await client.rpc('finish_meta_step',{p_request:requestId,p_status:'succeeded',p_result:result,p_type:type,p_variant:step.variant_id,p_label:step.label});
  if(finish.error)return NextResponse.json({error:'Meta confirmó el recurso, pero no se pudo guardar su vínculo. No repitas este paso. Comprueba el ID en Ads Manager.',external_id:result.id,image_hash:result.hash},{status:502,headers});
  return NextResponse.json({done:false,step:step.label,result},{headers});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo completar la preparación. Revisa los datos antes de continuar.'},{status:error instanceof ApiError?error.status:502,headers});}
}

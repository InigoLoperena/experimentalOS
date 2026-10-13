import {NextResponse} from 'next/server';
import {authenticatedClient,authorizedProject,ApiError} from '@/lib/server-access';
import {resolvedSmartlead} from '@/lib/integration-service';
import {smartleadCampaigns,smartleadId} from '@/lib/smartlead';
import {smartleadRecipe,smartleadSequence,smartleadWrite,smartleadVerifyDraft,SmartleadWriteError} from '@/lib/smartlead-build';
import {digest} from '@/lib/meta-build';
import type {Item} from '@/lib/model';
import type {Variant} from '@/lib/monitoring';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 const started=Date.now();
 let resources:{type:string;id:string;label:string;variant:null}[]=[];
 try{
  const {client}=await authenticatedClient(request),raw=await request.text();
  if(Buffer.byteLength(raw)>5000)throw new ApiError('Solicitud demasiado larga.',400);
  let body;try{body=JSON.parse(raw);}catch{throw new ApiError('Solicitud inválida.',400);}
  if(!body||!['review','create'].includes(body.action)||typeof body.experiment_id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.experiment_id))throw new ApiError('Selecciona un experimento válido.',400);
  const project=await authorizedProject(client,body.project_id);
  const permission=await client.rpc('can_record_action',{w:project.workspace_id,k:'experiment',a:'edit'});
  if(permission.error||!permission.data)throw new ApiError('Necesitas permiso para editar experimentos.',403);
  const record=await client.from('records').select('*').eq('id',body.experiment_id).eq('project_id',project.id).eq('kind','experiment').single();
  if(record.error||!record.data)throw new ApiError('No tienes acceso al experimento.',403);
  const experiment=record.data as Item;
  const spec=await client.from('experiment_specs').select('code').eq('experiment_id',experiment.id).single(),variants=await client.from('experiment_variants').select('*').eq('experiment_id',experiment.id);
  if(spec.error||variants.error)throw new ApiError('Guarda la ficha y sus variantes antes de continuar.',400);
  const connection=await resolvedSmartlead(client,project),recipe=smartleadRecipe(experiment,spec.data.code,variants.data as Variant[],connection),fingerprint=digest(recipe);
  await smartleadCampaigns(connection);
  if(body.action==='review')return NextResponse.json({fingerprint,recipe},{headers});
  if(body.confirmed!==true||body.fingerprint!==fingerprint||typeof body.request_id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.request_id))throw new ApiError('Revisa y confirma la preparación actual antes de enviarla.',409);
  if(Date.now()-started>15000)throw new ApiError('La comprobación tardó demasiado. No se enviaron cambios; vuelve a revisar.',503);
  const reserved=await client.rpc('reserve_smartlead',{p_id:body.request_id,p_experiment:experiment.id,p_fingerprint:fingerprint,p_revision:experiment.updated_at,p_account:digest({revision:connection.revision})});
  if(reserved.error)throw new ApiError('Ya existe una preparación enviada o pendiente. Comprueba Smartlead antes de repetir.',409);
  try{
   const result=await smartleadWrite(connection,'campaigns/create',{name:recipe.name});
   if(result.ok!==true)throw new SmartleadWriteError('Smartlead no confirmó la creación. Comprueba los borradores.',true);
   const id=smartleadId(result.id);resources=[{type:'campaign',id,label:recipe.name,variant:null}];
   const checkpoint=await client.rpc('finish_smartlead',{p_id:body.request_id,p_status:'pending',p_resources:resources});
   if(checkpoint.error)throw new SmartleadWriteError('Campaña creada, pero no se guardó el vínculo. Conserva el ID; no repitas el envío.',true);
   await smartleadWrite(connection,`campaigns/${id}/sequences`,smartleadSequence(recipe));
   await smartleadVerifyDraft(connection,id,recipe);
   const saved=await client.rpc('finish_smartlead',{p_id:body.request_id,p_status:'succeeded',p_resources:resources});
   if(saved.error)throw new SmartleadWriteError('Borrador confirmado, pero no se guardó la confirmación. Conserva el ID; no repitas el envío.',true);
  }catch(error){await client.rpc('finish_smartlead',{p_id:body.request_id,p_status:resources.length||!(error instanceof SmartleadWriteError)||error.uncertain?'uncertain':'rejected',p_resources:resources});throw error;}
  return NextResponse.json({resources,status:'DRAFTED'},{headers});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo preparar Smartlead.',resources},{status:error instanceof ApiError?error.status:502,headers});}
}

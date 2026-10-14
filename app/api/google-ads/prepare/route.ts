import {NextResponse} from 'next/server';
import {readJsonBody} from '@/lib/request-body';
import {authenticatedClient,authorizedProject,ApiError} from '@/lib/server-access';
import {resolvedGoogleAds} from '@/lib/integration-service';
import {googleAccessToken,googleAccount} from '@/lib/google-ads';
import {googleRecipe,googleOperations,googleMutate,googleCreated,GoogleMutationError} from '@/lib/google-ads-build';
import {digest} from '@/lib/meta-build';
import type {Item} from '@/lib/model';
import type {Variant} from '@/lib/monitoring';
import type {Attachment} from '@/lib/attachments';
import {googleDisplayImages} from '@/lib/google-ads-media';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 const started=Date.now();
 try{
  const {client}=await authenticatedClient(request);
  const body=await readJsonBody(request,5000);
  if(!body||!['review','create'].includes(body.action)||typeof body.experiment_id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.experiment_id))throw new ApiError('Selecciona un experimento válido.',400);
  const project=await authorizedProject(client,body.project_id);
  const permission=await client.rpc('can_record_action',{w:project.workspace_id,k:'experiment',a:'edit'});
  if(permission.error||!permission.data)throw new ApiError('Necesitas permiso para editar experimentos.',403);
  const record=await client.from('records').select('*').eq('id',body.experiment_id).eq('project_id',project.id).eq('kind','experiment').single();
  if(record.error||!record.data)throw new ApiError('No tienes acceso al experimento.',403);
  const experiment=record.data as Item;
  const spec=await client.from('experiment_specs').select('code').eq('experiment_id',experiment.id).single(),variants=await client.from('experiment_variants').select('*').eq('experiment_id',experiment.id);
  if(spec.error||variants.error)throw new ApiError('Guarda la ficha y sus variantes antes de continuar.',400);
  const connection=await resolvedGoogleAds(client,project),token=await googleAccessToken(connection),account=await googleAccount(connection,token);
  const recipe=googleRecipe(experiment,spec.data.code,variants.data as Variant[],connection,account);
  let attachments:Attachment[]=[];
  if(recipe.type==='DISPLAY'){
   const files=await client.from('record_attachments').select('*').eq('workspace_id',project.workspace_id).eq('record_id',experiment.id);
   if(files.error)throw new ApiError('No se pudieron leer las imágenes privadas.',503);
   attachments=files.data as Attachment[];
  }
  const images=await googleDisplayImages(client,experiment,recipe,attachments),operations=await googleOperations(connection,token,recipe,fetch,images),fingerprint=digest({recipe,operations});
  // Google checks the exact batch without executing it, both on review and immediately before creation.
  await googleMutate(connection,token,operations,true);
  if(body.action==='review')return NextResponse.json({fingerprint,recipe,account,previews:images.map(({bytes,...image})=>image)},{headers});
  if(body.confirmed!==true||body.fingerprint!==fingerprint||typeof body.request_id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.request_id))throw new ApiError('Revisa y confirma la preparación actual antes de enviarla.',409);
  if(Date.now()-started>30000)throw new ApiError('La validación tardó demasiado. No se enviaron cambios; vuelve a revisar.',503);
  const reserved=await client.rpc('reserve_google_ads',{p_id:body.request_id,p_experiment:experiment.id,p_fingerprint:fingerprint,p_revision:experiment.updated_at,p_account:connection.customerId});
  if(reserved.error)throw new ApiError('No se pudo reservar el envío. Puede haber una preparación anterior pendiente: comprueba Google Ads antes de repetir.',409);
  let resources;
  try{resources=googleCreated(await googleMutate(connection,token,operations,false),recipe,images);}
  catch(error){await client.rpc('finish_google_ads',{p_id:body.request_id,p_status:error instanceof GoogleMutationError&&!error.uncertain?'rejected':'uncertain',p_resources:[]});throw error;}
  const finished=await client.rpc('finish_google_ads',{p_id:body.request_id,p_status:'succeeded',p_resources:resources});
  if(finished.error)return NextResponse.json({error:'Google confirmó la creación, pero no se pudieron guardar sus vínculos. No repitas el envío; conserva estos IDs.',resources},{status:502,headers});
  return NextResponse.json({resources,name:recipe.name,status:'PAUSED'},{headers});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo preparar Google Ads. Revisa la ficha y su conexión.'},{status:error instanceof ApiError?error.status:502,headers});}
}

import {NextResponse} from 'next/server';
import {authenticatedClient,authorizedProject,ApiError} from '@/lib/server-access';
import type {Item} from '@/lib/model';
import {metaConnection,metaAccount} from '@/lib/meta-ads';
import {pausedCampaign,campaignFingerprint,createPausedCampaign,MetaCreationError} from '@/lib/meta-preparation';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
  try{
    const {client,user}=await authenticatedClient(request);
    const raw=await request.text();if(Buffer.byteLength(raw)>3000)throw new ApiError('La solicitud es demasiado larga.',400);
    let body;try{body=JSON.parse(raw);}catch{throw new ApiError('Solicitud inválida.',400);}
    if(!body||!['review','create'].includes(body.action)||typeof body.project_id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.experiment_id||''))throw new ApiError('Selecciona un experimento válido.',400);
    const project=await authorizedProject(client,body.project_id);
    const member=await client.from('members').select('role').eq('workspace_id',project.workspace_id).eq('user_id',user.id).single();
    if(!['owner','editor'].includes(member.data?.role||''))throw new ApiError('Solo administradores y editores pueden preparar campañas.',403);
    const saved=await client.from('records').select('*').eq('id',body.experiment_id).eq('project_id',project.id).eq('workspace_id',project.workspace_id).eq('kind','experiment').single();
    const spec=await client.from('experiment_specs').select('code').eq('experiment_id',body.experiment_id).eq('workspace_id',project.workspace_id).single();
    if(!saved.data||saved.error||!spec.data||spec.error)throw new ApiError('Guarda el experimento antes de prepararlo en Meta.',400);
    const experiment=saved.data as Item;
    const payload=pausedCampaign(experiment,spec.data.code,body.category);
    const fingerprint=campaignFingerprint(payload,experiment.updated_at);
    const connection=metaConnection(project);
    const account=await metaAccount(connection);
    if(!account.active)throw new ApiError('Meta indica que la cuenta no está activa. Revisa Ads Manager.',400);
    const receipt=await client.from('meta_campaign_preparations').select('status,external_id').eq('experiment_id',experiment.id).single();
    if(receipt.error && receipt.error.code!=='PGRST116')throw new ApiError('No se pudo comprobar una creación anterior. No se enviaron cambios a Meta.',503);
    const writeToken=process.env.META_ADS_WRITE_ACCESS_TOKEN?.trim();
    if(body.action==='review')return NextResponse.json({account,name:payload.name,objective:'Tráfico a una web',status:'PAUSED',fingerprint,revision:experiment.updated_at,write_available:!!writeToken,previous:receipt.data||null},{headers});
    if(body.confirmed!==true||body.fingerprint!==fingerprint||body.revision!==experiment.updated_at)throw new ApiError('Confirma la revisión actual antes de crear la campaña pausada.',409);
    if(!writeToken)throw new ApiError('Falta el token de escritura de Meta con ads_management. La conexión de lectura sigue disponible.',503);
    if(!/^[0-9a-f-]{36}$/i.test(body.request_id||''))throw new ApiError('La solicitud no es válida.',400);
    const writeConnection={...connection,token:writeToken};
    await metaAccount(writeConnection); // Verify the write credential accesses the same bound account.
    const reserved=await client.rpc('reserve_meta_campaign',{p_experiment:experiment.id,p_request:body.request_id,p_fingerprint:fingerprint,p_expected:experiment.updated_at});
    if(reserved.error)throw new ApiError(reserved.error.message,409);
    let externalId:string;
    try{externalId=await createPausedCampaign(writeConnection,payload);}
    catch(error){
      const status=error instanceof MetaCreationError&&!error.uncertain?'rejected':'uncertain';
      const finished=await client.rpc('finish_meta_campaign',{p_request:body.request_id,p_status:status});
      if(finished.error)throw new ApiError('No se pudo guardar el resultado. No repitas la creación: consulta Ads Manager.',502);
      throw error;
    }
    const linked=await client.rpc('finish_meta_campaign',{p_request:body.request_id,p_status:'linked',p_external:externalId,p_label:payload.name});
    const url=`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${connection.accountId}&selected_campaign_ids=${externalId}`;
    if(linked.error)return NextResponse.json({error:'Meta creó la campaña pausada, pero no se pudo guardar su vínculo. No repitas la creación: vincula este ID manualmente.',external_id:externalId,url},{status:502,headers});
    return NextResponse.json({external_id:externalId,url,status:'PAUSED'},{headers});
  }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo completar la preparación. Revisa los datos y Ads Manager antes de repetir.'},{status:error instanceof ApiError?error.status:502,headers});}
}

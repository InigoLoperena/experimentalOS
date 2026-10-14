import {NextResponse} from 'next/server';
import {readJsonBody} from '@/lib/request-body';
import {authenticatedClient,authorizedProject,ApiError} from '@/lib/server-access';
import {resolvedGoogleAds} from '@/lib/integration-service';
import {googleAccessToken,googleAccount,googleCampaigns,googleReport,googleId,googleSearch} from '@/lib/google-ads';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 try{
  const {client}=await authenticatedClient(request);
  const body=await readJsonBody(request,5000);
  if(!body||typeof body.project_id!=='string'||!['connection','campaigns','preview','report','status'].includes(body.action))throw new ApiError('Selecciona un proyecto y una consulta válidos.',400);
  const project=await authorizedProject(client,body.project_id);
  if(body.action==='status'){
   if(typeof body.experiment_id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.experiment_id))throw new ApiError('Selecciona un experimento válido.',400);
   const record=await client.from('records').select('id').eq('id',body.experiment_id).eq('project_id',project.id).eq('workspace_id',project.workspace_id).eq('kind','experiment').single();
   if(record.error||!record.data)throw new ApiError('No tienes acceso al experimento.',403);
   const [linked,attempts]=await Promise.all([
    client.from('external_resources').select('external_id,label,observed_status').eq('workspace_id',project.workspace_id).eq('project_id',project.id).eq('experiment_id',body.experiment_id).eq('provider','google_ads').eq('resource_type','campaign'),
    client.from('google_ads_preparations').select('status').eq('workspace_id',project.workspace_id).eq('project_id',project.id).eq('experiment_id',body.experiment_id).in('status',['pending','uncertain']),
   ]);
   if(linked.error||attempts.error)throw new ApiError('No se pudo consultar el estado guardado del envío.',503);
   let campaigns=(linked.data||[]).filter(row=>row.external_id).map(row=>({id:googleId(row.external_id),name:row.label,status:row.observed_status,live:false}));
   if(body.refresh===true&&campaigns.length){
    const connection=await resolvedGoogleAds(client,project),token=await googleAccessToken(connection);
    const rows=await googleSearch(connection,token,`SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.id IN (${campaigns.map(row=>row.id).join(',')})`);
    for(const row of rows)if(!campaigns.some(c=>c.id===String(row.campaign?.id)))throw new ApiError('Google devolvió otra campaña. No se actualizó el estado.',502);
    campaigns=campaigns.map(c=>{const row=rows.find(row=>String(row.campaign?.id)===c.id)?.campaign;return {...c,...(row&&typeof row.name==='string'&&typeof row.status==='string'?{name:row.name,status:row.status,live:true}:{status:'unknown',live:false})};});
   }
   return NextResponse.json({campaigns,pending:!!attempts.data?.length},{headers});
  }
  if(body.action==='connection'){
   try{await resolvedGoogleAds(client,project);}catch(error){if(error instanceof ApiError&&error.status===403)return NextResponse.json({available:false},{headers});throw error;}
   return NextResponse.json({available:true},{headers});
  }
  const connection=await resolvedGoogleAds(client,project),token=await googleAccessToken(connection);
  if(body.action==='campaigns')return NextResponse.json({account:await googleAccount(connection,token),campaigns:await googleCampaigns(connection,token)},{headers});
  if(body.action==='preview')return NextResponse.json({resource_id:null,...await googleReport(connection,token,googleId(body.external_id),'campaign',body.start,body.end)},{headers});
  if(typeof body.resource_id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.resource_id))throw new ApiError('Selecciona un recurso vinculado.',400);
  const {data:resource,error}=await client.from('external_resources').select('*').eq('id',body.resource_id).eq('project_id',project.id).eq('workspace_id',project.workspace_id).eq('provider','google_ads').single();
  if(error||!resource)throw new ApiError('No tienes acceso a ese recurso de Google Ads.',403);
  return NextResponse.json({resource_id:resource.id,...await googleReport(connection,token,googleId(resource.external_id),resource.resource_type,body.start,body.end)},{headers});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo consultar Google Ads.'},{status:error instanceof ApiError?error.status:502,headers});}
}

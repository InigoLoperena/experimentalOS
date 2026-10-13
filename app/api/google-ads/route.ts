import {NextResponse} from 'next/server';
import {authenticatedClient,authorizedProject,ApiError} from '@/lib/server-access';
import {resolvedGoogleAds} from '@/lib/integration-service';
import {googleAccessToken,googleAccount,googleCampaigns,googleReport,googleId} from '@/lib/google-ads';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 try{
  const {client}=await authenticatedClient(request);
  const raw=await request.text();if(Buffer.byteLength(raw)>5000)throw new ApiError('Solicitud demasiado larga.',400);
  let body;try{body=JSON.parse(raw);}catch{throw new ApiError('Solicitud inválida.',400);}
  if(!body||typeof body.project_id!=='string'||!['connection','campaigns','preview','report'].includes(body.action))throw new ApiError('Selecciona un proyecto y una consulta válidos.',400);
  const project=await authorizedProject(client,body.project_id);
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

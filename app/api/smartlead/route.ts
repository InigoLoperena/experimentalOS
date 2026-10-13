import {NextResponse} from 'next/server';
import {readJsonBody} from '@/lib/request-body';
import {authenticatedClient,authorizedProject,ApiError} from '@/lib/server-access';
import {resolvedSmartlead} from '@/lib/integration-service';
import {smartleadCampaigns,smartleadReport,smartleadId} from '@/lib/smartlead';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 try{
  const {client}=await authenticatedClient(request);
  const body=await readJsonBody(request,5000);
  if(!body||typeof body.project_id!=='string'||!['connection','campaigns','preview','report'].includes(body.action))throw new ApiError('Selecciona un proyecto y una consulta válidos.',400);
  const project=await authorizedProject(client,body.project_id);
  if(body.action==='connection'){
   try{await resolvedSmartlead(client,project);}catch(error){if(error instanceof ApiError&&error.status===403)return NextResponse.json({available:false},{headers});throw error;}
   return NextResponse.json({available:true},{headers});
  }
  const connection=await resolvedSmartlead(client,project);
  if(body.action==='campaigns')return NextResponse.json({campaigns:await smartleadCampaigns(connection)},{headers});
  if(body.action==='preview')return NextResponse.json({resource_id:null,...await smartleadReport(connection,smartleadId(body.external_id),body.start,body.end)},{headers});
  if(typeof body.resource_id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.resource_id))throw new ApiError('Selecciona un recurso vinculado.',400);
  const {data:resource,error}=await client.from('external_resources').select('*').eq('id',body.resource_id).eq('project_id',project.id).eq('workspace_id',project.workspace_id).eq('provider','smartlead').single();
  if(error||!resource||resource.resource_type!=='campaign')throw new ApiError('No tienes acceso a ese recurso de Smartlead.',403);
  return NextResponse.json({resource_id:resource.id,...await smartleadReport(connection,smartleadId(resource.external_id),body.start,body.end)},{headers});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo consultar Smartlead.'},{status:error instanceof ApiError?error.status:502,headers});}
}

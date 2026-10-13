import {NextResponse} from 'next/server';
import {readJsonBody} from '@/lib/request-body';
import {authenticatedClient,authorizedProject,ApiError} from '@/lib/server-access';
import {connectionSecrets,storedConnection} from '@/lib/integration-service';
import {metricoolBrand,metricoolNetwork,metricoolPeriod,metricoolPosts} from '@/lib/metricool';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 try{
  const {client}=await authenticatedClient(request);
  const body=await readJsonBody(request,4000);
  if(typeof body?.project_id!=='string')throw new ApiError('Selecciona un proyecto.',400);
  const project=await authorizedProject(client,body.project_id);
  const row=await storedConnection(client,project.workspace_id,'metricool',project.id);
  if(!row)throw new ApiError('Configura el token de esta marca en Integraciones → Metricool. Requiere acceso API de Metricool.',403);
  const secrets=await connectionSecrets(client,row,project);
  const connection={userId:row.config.user_id,blogId:row.config.blog_id,token:secrets.api_key};
  const brand=await metricoolBrand(connection);
  if(body.action==='connection')return NextResponse.json({brand},{headers});
  if(body.action!=='posts')throw new ApiError('Selecciona una operación válida.',400);
  const network=metricoolNetwork(body.network),period=metricoolPeriod(body.start,body.end);
  if(!brand.networks.includes(network))throw new ApiError('Esta red no está conectada a la marca de Metricool.',400);
  const posts=await metricoolPosts(connection,network,period.start,period.end,brand.timezone);
  return NextResponse.json({brand,posts},{headers});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo consultar Metricool.'},{status:error instanceof ApiError?error.status:502,headers});}
}

import {NextResponse} from 'next/server';
import {readJsonBody} from '@/lib/request-body';
import {authenticatedClient,authorizedProject,ApiError} from '@/lib/server-access';
import {resolvedMetricool} from '@/lib/integration-service';
import {metricoolBrand,metricoolNetwork,metricoolPeriod,metricoolPosts} from '@/lib/metricool';
import {persistProviderResult} from '@/lib/provider-result-memory';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 try{
  const {client}=await authenticatedClient(request);
  const body=await readJsonBody(request,4000);
  if(typeof body?.project_id!=='string')throw new ApiError('Selecciona un proyecto.',400);
  const project=await authorizedProject(client,body.project_id);
  const connection=await resolvedMetricool(client,project);
  const brand=await metricoolBrand(connection);
  if(body.action==='connection')return NextResponse.json({brand},{headers});
  if(body.action!=='posts')throw new ApiError('Selecciona una operación válida.',400);
  const network=metricoolNetwork(body.network),period=metricoolPeriod(body.start,body.end);
  if(!brand.networks.includes(network))throw new ApiError('Esta red no está conectada a la marca de Metricool.',400);
  const posts=await metricoolPosts(connection,network,period.start,period.end,brand.timezone);
  const linked=await client.from('external_resources').select('*').eq('workspace_id',project.workspace_id).eq('project_id',project.id).eq('provider','metricool').eq('resource_type','post');
  if(linked.error)throw new ApiError('No se pudieron comprobar las publicaciones vinculadas.',503);
  const storage=[];
  for(const post of posts){const resource=linked.data?.find(r=>r.external_id===post.id);if(resource)storage.push(await persistProviderResult(client,resource,{network,post,measurement_kind:'cumulative_snapshot',meaning:'Acumulado por publicación consultado ahora; el rango selecciona su fecha de publicación, no la fecha de las interacciones.'},post.metrics,period.start,period.end));}
  return NextResponse.json({brand,posts,storage},{headers});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo consultar Metricool.'},{status:error instanceof ApiError?error.status:502,headers});}
}

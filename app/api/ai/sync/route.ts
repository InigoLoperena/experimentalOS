import {NextResponse} from 'next/server';
import {authenticatedClient,authorizedWorkspace,authorizedProject,ApiError} from '@/lib/server-access';
import {readJsonBody} from '@/lib/request-body';
import {resolvedMetaConnection,resolvedGoogleAds,resolvedSmartlead,resolvedMetricool,resolvedPosthog} from '@/lib/integration-service';
import {metaReport} from '@/lib/meta-ads';
import {googleAccessToken,googleReport,googleId} from '@/lib/google-ads';
import {smartleadReport,smartleadId} from '@/lib/smartlead';
import {metricoolBrand,metricoolPosts,metricoolNetwork} from '@/lib/metricool';
import {posthogJson,posthogIdentifier} from '@/lib/posthog-api';
import {posthogStatus} from '@/lib/posthog-sync';
import {persistProviderResult} from '@/lib/provider-result-memory';
import type {ExternalResource,CsvMetric} from '@/lib/monitoring';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(request:Request){
 try{
  const {client}=await authenticatedClient(request),body=await readJsonBody(request,2000),space=await authorizedWorkspace(client,body.workspace_id);
  const permission=await client.rpc('can_record_action',{w:space.id,k:'experiment',a:'edit'});if(permission.error||!permission.data)throw new ApiError('Necesitas permiso para editar experimentos y sincronizar sus resultados.',403);
  if(body.after!==undefined&&(typeof body.after!=='string'||!/^[0-9a-f-]{36}$/i.test(body.after)))throw new ApiError('Cursor de sincronización no válido.',400);
  let query=client.from('external_resources').select('*').eq('workspace_id',space.id).in('provider',['meta_ads','google_ads','smartlead','metricool','posthog']).order('id').limit(3);
  if(body.after)query=query.gt('id',body.after);
  const read=await query;if(read.error)throw new ApiError('No se pudieron leer los recursos vinculados.',503);
  const batch=(read.data||[]).slice(0,2) as ExternalResource[],results=[];
  const start=new Date(Date.now()-7*86400000).toISOString().slice(0,10),end=new Date(Date.now()-86400000).toISOString().slice(0,10);
  for(const resource of batch){
   try{
    const project=await authorizedProject(client,resource.project_id);let data:Record<string,unknown>,metrics:CsvMetric[]=[],status:string|undefined;
    if(resource.provider==='meta_ads'){
     const report=await metaReport(await resolvedMetaConnection(client,project),resource.external_id!,resource.resource_type,start,end);data={name:report.name,status:report.status,metrics:report.metrics};metrics=report.metrics;status=report.status;
    }else if(resource.provider==='google_ads'){
     const c=await resolvedGoogleAds(client,project),report=await googleReport(c,await googleAccessToken(c),googleId(resource.external_id),resource.resource_type,start,end);data={name:report.name,status:report.status,metrics:report.metrics};metrics=report.metrics;status=report.status;
    }else if(resource.provider==='smartlead'){
     if(resource.resource_type!=='campaign')throw new Error('Solo se sincronizan campañas de Smartlead.');
     const report=await smartleadReport(await resolvedSmartlead(client,project),smartleadId(resource.external_id),start,end);data={name:report.name,status:report.status,metrics:report.metrics};metrics=report.metrics;status=report.status;
    }else if(resource.provider==='metricool'){
     const c=await resolvedMetricool(client,project),brand=await metricoolBrand(c),since=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
     const reads=await Promise.allSettled(brand.networks.map(network=>metricoolPosts(c,metricoolNetwork(network),since,end,brand.timezone)));
     const post=reads.flatMap(r=>r.status==='fulfilled'?r.value:[]).find(p=>p.id===resource.external_id);
     if(!post)throw new Error('No se encontró la publicación entre las publicadas en los últimos 30 días. No se han inventado ceros ni borrado datos.');
     data={post,measurement_kind:'cumulative_snapshot',meaning:'Acumulado por publicación, no interacciones atribuidas al rango.'};metrics=post.metrics;
    }else{
     const c=await resolvedPosthog(client,project),url=`${c.host}/api/projects/${posthogIdentifier(c.projectId)}/experiments/${posthogIdentifier(resource.external_id||'')}`;
     const detail=await posthogJson(url+'/',c.key);let result=null;
     if(detail.start_date)result=await posthogJson(url+'/metrics_recalculation/latest/',c.key);
     data={name:detail.name,start_date:detail.start_date||null,end_date:detail.end_date||null,results:result};status=posthogStatus(detail);
    }
    const saved=await persistProviderResult(client,resource,data,metrics,resource.provider==='posthog'?null:start,resource.provider==='posthog'?null:end);
    if(saved.saved&&status){await client.from('external_resources').update({observed_status:status}).eq('workspace_id',space.id).eq('id',resource.id).eq('updated_at',resource.updated_at);}
    results.push({id:resource.id,provider:resource.provider,label:resource.label||resource.external_id,...saved});
   }catch(error){results.push({id:resource.id,provider:resource.provider,label:resource.label||resource.external_id,saved:false,note:error instanceof ApiError?error.message:error instanceof Error&&error.message.startsWith('No se encontró')?error.message:'No se pudo sincronizar este recurso. Revisa su conexión y vuelve a intentarlo.'});}
  }
  return NextResponse.json({results,period:{start,end},next:(read.data?.length||0)>2?batch.at(-1)?.id:null},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo sincronizar la memoria.'},{status:error instanceof ApiError?error.status:502});}
}

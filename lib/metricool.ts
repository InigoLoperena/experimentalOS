import {ApiError} from './server-access';
import type {CsvMetric} from './monitoring';
export type MetricoolConnection={userId:string;blogId:string;token:string};
export const metricoolNetworks={facebook:'Facebook',instagram:'Instagram',tiktok:'TikTok',youtube:'YouTube'} as const;
export type MetricoolNetwork=keyof typeof metricoolNetworks;
export type MetricoolPost={id:string;network:string;text:string;url:string|null;status:string;metrics:CsvMetric[]};
export function metricoolNetwork(value:unknown):MetricoolNetwork{
 if(typeof value!=='string'||!Object.hasOwn(metricoolNetworks,value))throw new ApiError('Selecciona una red de Metricool.',400);
 return value as MetricoolNetwork;
}
export function metricoolPeriod(start:unknown,end:unknown){
 const date=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!date(start)||!date(end)||end<start||(Date.parse(end)-Date.parse(start))/86400000>30)throw new ApiError('Selecciona un periodo de hasta 31 días.',400);
 return {start,end};
}
// Fixed host and explicit read-only endpoint allowlist. Secrets never enter URLs or errors.
export async function metricoolJson(connection:MetricoolConnection,path:string,params:Record<string,string>={},fetcher:typeof fetch=fetch):Promise<Record<string,unknown>>{
 if(!['/admin/simpleProfiles','/v2/scheduler/posts','/v2/analytics/posts/facebook','/v2/analytics/posts/instagram','/v2/analytics/posts/tiktok','/v2/analytics/posts/youtube'].includes(path)&&!/^\/v2\/scheduler\/posts\/\d{1,10}$/.test(path))throw new ApiError('Operación de Metricool no admitida.',400);
 if(!/^\d{1,30}$/.test(connection.userId)||!/^\d{1,30}$/.test(connection.blogId)||!connection.token)throw new ApiError('Revisa la conexión de Metricool.',400);
 const url=new URL(`https://app.metricool.com/api${path}`);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 url.searchParams.set('userId',connection.userId);url.searchParams.set('blogId',connection.blogId);
 let response;try{response=await fetcher(url,{headers:{'X-Mc-Auth':connection.token},method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});}catch{throw new ApiError('Metricool no respondió. Puedes volver a consultar sin crear publicaciones.',502);}
 if(!response.ok)throw new ApiError(response.status===401||response.status===403?'Metricool rechazó el acceso. Comprueba el token, la marca y un plan Advanced o Custom.':'Metricool no pudo completar la consulta.',502);
 const value=await response.json().catch(()=>null);
 if(Array.isArray(value))return {data:value};
 if(!value||typeof value!=='object'||value.error)throw new ApiError('Metricool devolvió datos no válidos.',502);
 return value;
}
export async function metricoolBrand(connection:MetricoolConnection,fetcher:typeof fetch=fetch){
 const result=await metricoolJson(connection,'/admin/simpleProfiles',{},fetcher);
 if(!Array.isArray(result.data))throw new ApiError('Metricool no confirmó la marca.',502);
 const brand=result.data.find(r=>String(r.id)===connection.blogId);
 if(!brand)throw new ApiError('El token no tiene acceso a la marca indicada.',403);
 return {id:String(brand.id),name:String(brand.label||''),timezone:String(brand.timezone||'UTC'),networks:Object.keys(brand.networksData||{}).map(n=>n.replace(/Data$/,''))};
}
const safeUrl=(value:unknown)=>{try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
export function metricoolPublished(row:Record<string,unknown>,network:MetricoolNetwork,start:string,end:string):MetricoolPost{
 const rawId=row.postId??row.videoId??row.id;if(typeof rawId!=='string'&&typeof rawId!=='number')throw new ApiError('Publicación sin identificador.',502);
 const id=`${network}:${String(rawId)}`;
 if(id.length>200||!/^[a-z]+:[A-Za-z0-9_-]+$/.test(id))throw new ApiError('Identificador de publicación no válido.',502);
 const fields=network==='instagram'?{likes:'likes',comments:'comments',shares:'shares',saved:'saved',reach:'reach',views:'views',interactions:'interactions'}:network==='tiktok'?{likeCount:'likes',commentCount:'comments',shareCount:'shares',viewCount:'views',reach:'reach'}:network==='facebook'?{reactions:'reactions',comments:'comments',shares:'shares',clicks:'clicks',linkclicks:'link_clicks',videoViews:'views'}:{views:'views',likes:'likes',comments:'comments'};
 const metrics:CsvMetric[]=[];
 for(const [field,key] of Object.entries(fields)){const value=row[field];if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)metrics.push({external_id:id,metric:key,unit:'count',currency:null,value,period_start:start,period_end:end,notes:`Metricool · ${network}; acumulado de la publicación consultado ${new Date().toISOString()}. El rango selecciona publicaciones por fecha; no atribuye sus interacciones al periodo. No sumar snapshots.`});}
 return {id,network,text:String(row.content??row.text??row.videoDescription??row.title??'').slice(0,4000),url:safeUrl(row.url??row.link??row.shareUrl),status:'published',metrics};
}
export async function metricoolPosts(connection:MetricoolConnection,network:MetricoolNetwork,start:string,end:string,timezone:string,fetcher:typeof fetch=fetch){
 metricoolPeriod(start,end);
 const result=await metricoolJson(connection,`/v2/analytics/posts/${network}`,{from:`${start}T00:00:00`,to:`${end}T23:59:59`,timezone},fetcher);
 // Never silently import a truncated page, and never follow a token-bearing next URL.
 if((result.page as {next?:unknown}|undefined)?.next)throw new ApiError('Metricool devolvió más páginas. Reduce el periodo antes de importar para evitar datos incompletos.',422);
 if(!Array.isArray(result.data))throw new ApiError('Metricool no devolvió una lista de publicaciones.',502);
 return result.data.map(row=>metricoolPublished(row,network,start,end));
}

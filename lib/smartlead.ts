import {ApiError} from './server-access';
import {metaPeriod} from './meta-ads';
import type {CsvMetric} from './monitoring';
export type SmartleadConnection={key:string;revision:string};
export type SmartleadCampaign={id:string;name:string;status:string;url:string};
export type SmartleadReport={storage?:{saved:boolean;note:string};resource_id:string|null;name:string;status:string;metrics:CsvMetric[];fetched_at:string};
export function smartleadId(value:unknown){const id=String(value);if(typeof value==='number'&&!Number.isSafeInteger(value)||!/^[1-9][0-9]{0,15}$/.test(id))throw new ApiError('Introduce un ID numérico de Smartlead.',400);return id;}
// API keys are required in the query by Smartlead. Never log URLs or provider errors.
export async function smartleadRequest(c:SmartleadConnection,path:string,params:Record<string,string>={},fetcher:typeof fetch=fetch){
 if(!c.key)throw new ApiError('Configura Smartlead en Integraciones.',403);
 const url=new URL(`https://server.smartlead.ai/api/v1/${path}`);url.search=new URLSearchParams({...params,api_key:c.key}).toString();
 let response;try{response=await fetcher(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw new ApiError('Smartlead no respondió. No se importaron datos incompletos.',502);}
 const result=await response.json().catch(()=>null);
 if(!response.ok||result?.ok===false||result?.error){console.warn('Smartlead read rejected',{status:response.status,operation:path==='campaigns/'?'campaign-list':'report',json:result!==null});throw new ApiError(response.status===429?'Smartlead limita las consultas. Espera antes de intentarlo de nuevo.':response.status===401||response.status===403?`Smartlead rechazó el acceso API (HTTP ${response.status}). Revisa la clave, sus restricciones y el acceso del plan en Integraciones.`:'Smartlead rechazó la consulta.',response.status===429?429:502);}
 if(!result||typeof result!=='object')throw new ApiError('Smartlead devolvió datos no válidos.',502);
 return result;
}
export async function smartleadCampaigns(c:SmartleadConnection,fetcher:typeof fetch=fetch):Promise<SmartleadCampaign[]>{
 const rows=await smartleadRequest(c,'campaigns/',{},fetcher);
 if(!Array.isArray(rows)||rows.length>10000)throw new ApiError('Lista de campañas no válida o demasiado extensa.',502);
 return rows.map(v=>{if(typeof v.name!=='string'||typeof v.status!=='string')throw new ApiError('Campaña no válida.',502);return {id:smartleadId(v.id),name:v.name,status:v.status,url:'https://app.smartlead.ai/'};});
}
export function smartleadMetrics(row:Record<string,unknown>,id:string,start:string,end:string):CsvMetric[]{
 const metrics:CsvMetric[]=[];
 for(const [metric,field] of [['emails_sent','sent'],['email_opens','opened'],['email_replies','replied'],['email_bounces','bounced'],['unique_leads','unique_lead_count'],['unique_email_opens','unique_open_count']] as const){
  const raw=row[field];if(raw==null)continue;
  if(typeof raw!=='number'&&!(typeof raw==='string'&&/^\d+$/.test(raw)))throw new ApiError('Recuento no válido de Smartlead.',502);
  const value=Number(raw);if(!Number.isSafeInteger(value)||value<0||value>=1e12)throw new ApiError('Recuento fuera de rango.',502);
  metrics.push({external_id:id,metric,unit:'count',currency:null,value,period_start:start,period_end:end,notes:'Smartlead · atribución a correos enviados en el periodo · UTC. Los recuentos únicos no se suman entre periodos; aperturas no equivalen a usuarios interesados.'});
 }
 return metrics;
}
export async function smartleadReport(c:SmartleadConnection,id:string,start:unknown,end:unknown,fetcher:typeof fetch=fetch){
 smartleadId(id);const period=metaPeriod(start,end);
 const campaign=await smartleadRequest(c,`campaigns/${id}`,{},fetcher);
 if(String(campaign.id)!==id||typeof campaign.name!=='string')throw new ApiError('Smartlead no confirmó la campaña solicitada.',502);
 const result=await smartleadRequest(c,'analytics/campaign/overall-stats',{campaign_ids:id,start_date:period.since,end_date:period.until,timezone:'UTC',full_data:'true'},fetcher);
 const rows=result.data?.campaign_wise_performance;
 if(!Array.isArray(rows)||rows.length>1||rows.some((r:any)=>String(r.id)!==id))throw new ApiError('Smartlead devolvió otro recurso o resultados incompletos.',502);
 return {name:campaign.name,status:String(campaign.status||''),metrics:rows.length?smartleadMetrics(rows[0],id,period.since,period.until):[],fetched_at:new Date().toISOString()};
}

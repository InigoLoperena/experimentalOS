import {ApiError} from './server-access';
import {metaPeriod} from './meta-ads';
import type {CsvMetric} from './monitoring';
export type GoogleAdsConnection={customerId:string;loginCustomerId?:string;clientId:string;clientSecret:string;refreshToken:string;developerToken?:string};
export function googleHeaders(c:GoogleAdsConnection,token:string){return {Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(c.loginCustomerId?{'login-customer-id':googleId(c.loginCustomerId)}:{}),...(c.developerToken?{'developer-token':c.developerToken}:{})};}
export type GoogleAdsCampaign={id:string;name:string;status:string;type:string;url:string};
export type GoogleAdsAccount={id:string;name:string;currency:string;timezone:string;test:boolean;manager:boolean};
export type GoogleAdsReport={resource_id:string|null;name:string;status:string;metrics:CsvMetric[];fetched_at:string;account:GoogleAdsAccount};
export function googleId(value:unknown):string{if(typeof value!=='string'||!/^\d{1,30}$/.test(value))throw new ApiError('Introduce un ID numérico de Google Ads.',400);return value;}
export async function googleAccessToken(connection:GoogleAdsConnection,fetcher:typeof fetch=fetch){
 if(!/^\d{10}$/.test(connection.customerId)||(connection.loginCustomerId&&!/^\d{10}$/.test(connection.loginCustomerId)))throw new ApiError('Revisa el ID de cuenta de Google Ads (10 dígitos).',400);
 if(!connection.clientId||!connection.clientSecret||!connection.refreshToken)throw new ApiError('Completa OAuth de Google Ads en Integraciones.',403);
 let response;try{response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:connection.clientId,client_secret:connection.clientSecret,refresh_token:connection.refreshToken}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw new ApiError('Google no respondió al renovar OAuth.',502);}
 const result=await response.json().catch(()=>null);
 if(!response.ok||typeof result?.access_token!=='string'||!result.access_token||result.token_type?.toLowerCase()!=='bearer')throw new ApiError('Google rechazó OAuth. Reautoriza la conexión; comprueba si el refresh token de una app en pruebas ha caducado.',403);
 return result.access_token as string;
}
export async function googleSearch(connection:GoogleAdsConnection,token:string,query:string,fetcher:typeof fetch=fetch){
 const rows:Record<string,any>[]=[];let pageToken:string|undefined;const seen=new Set<string>();
 for(let page=0;page<20;page++){
  let response;try{response=await fetcher(`https://googleads.googleapis.com/v25/customers/${googleId(connection.customerId)}/googleAds:search`,{method:'POST',headers:googleHeaders(connection,token),body:JSON.stringify({query,...(pageToken?{pageToken}:{})}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new ApiError('Google Ads no respondió. No se importaron datos incompletos.',502);}
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.error){const codes=JSON.stringify(result?.error?.details?.map((d:any)=>d.errors?.map((e:any)=>e.errorCode))||[]);throw new ApiError(/CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION|ACTION_NOT_PERMITTED/.test(codes)?'Google Cloud solo permite cuentas de prueba. Solicita acceso Explorer para consultar esta cuenta real.':'Google Ads rechazó la consulta. Revisa la cuenta, el acceso de Cloud y los permisos OAuth.',502);}
  if(!result||!Array.isArray(result.results??[])||result.nextPageToken!=null&&typeof result.nextPageToken!=='string')throw new ApiError('Google Ads devolvió datos no válidos.',502);
  rows.push(...(result.results||[]));
  if(!result.nextPageToken)return rows;
  if(seen.has(result.nextPageToken))throw new ApiError('Google repitió una página. No se importaron datos incompletos.',502);
  seen.add(result.nextPageToken);pageToken=result.nextPageToken;
 }
 throw new ApiError('Demasiadas páginas. Reduce el alcance de la consulta.',422);
}
export async function googleAccount(c:GoogleAdsConnection,token:string,fetcher:typeof fetch=fetch):Promise<GoogleAdsAccount>{
 const rows=await googleSearch(c,token,'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.test_account, customer.manager FROM customer LIMIT 1',fetcher);
 const row=rows[0]?.customer;
 if(!row||String(row.id)!==c.customerId||typeof row.currencyCode!=='string'||typeof row.timeZone!=='string')throw new ApiError('Google no confirmó la cuenta configurada.',403);
 if(row.manager)throw new ApiError('Selecciona una cuenta publicitaria cliente, no una cuenta administradora.',400);
 return {id:c.customerId,name:String(row.descriptiveName||c.customerId),currency:row.currencyCode,timezone:row.timeZone,test:row.testAccount===true,manager:row.manager===true};
}
export async function googleCampaigns(c:GoogleAdsConnection,token:string,fetcher:typeof fetch=fetch):Promise<GoogleAdsCampaign[]>{
 const rows=await googleSearch(c,token,"SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY campaign.id",fetcher);
 return rows.map(row=>{const v=row.campaign;if(!v||typeof v.name!=='string'||typeof v.status!=='string')throw new ApiError('Campaña de Google Ads no válida.',502);return {id:googleId(String(v.id)),name:v.name,status:v.status,type:String(v.advertisingChannelType||''),url:`https://ads.google.com/aw/campaigns?campaignId=${googleId(String(v.id))}`};});
}
export function googleMetrics(metrics:Record<string,unknown>,id:string,currency:string,start:string,end:string):CsvMetric[]{
 const result:CsvMetric[]=[];
 for(const [key,field,unit,divisor] of [['impressions','impressions','count',1],['clicks','clicks','count',1],['spend','costMicros','currency',1000000],['conversions','conversions','number',1]] as const){
  const raw=metrics[field];if(raw===undefined||raw===null)continue;
  if(typeof raw!=='number'&&!(typeof raw==='string'&&/^\d+(\.\d+)?$/.test(raw)))throw new ApiError('Métrica numérica no válida.',502);
  const n=Number(raw);if(!Number.isFinite(n)||n<0||n>=1e12||(unit==='count'&&!Number.isSafeInteger(n)))throw new ApiError('Métrica fuera de rango.',502);
  result.push({external_id:id,metric:key,unit,currency:unit==='currency'?currency:null,value:n/divisor,period_start:start,period_end:end,notes:'Google Ads · periodo en la zona horaria de la cuenta; conversiones según la atribución configurada. No sumar recursos padre e hijos.'});
 }
 return result;
}
export async function googleReport(c:GoogleAdsConnection,token:string,id:string,type:string,start:unknown,end:unknown,fetcher:typeof fetch=fetch){
 googleId(id);const period=metaPeriod(start,end);const account=await googleAccount(c,token,fetcher);
 const map={campaign:{from:'campaign',id:'campaign.id',extra:'campaign.name, campaign.status'},adset:{from:'ad_group',id:'ad_group.id',extra:'ad_group.name, ad_group.status'},ad:{from:'ad_group_ad',id:'ad_group_ad.ad.id',extra:'ad_group_ad.status'}};
 if(!Object.hasOwn(map,type))throw new ApiError('Selecciona campaña, grupo o anuncio.',400);
 const resource=map[type as keyof typeof map];
 const rows=await googleSearch(c,token,`SELECT ${resource.id}, ${resource.extra}, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM ${resource.from} WHERE ${resource.id} = ${id} AND segments.date BETWEEN '${period.since}' AND '${period.until}'`,fetcher);
 if(rows.length>1)throw new ApiError('Google devolvió varias filas inesperadas. Revisa la segmentación antes de importar.',502);
 const row=rows[0],entity=type==='campaign'?row?.campaign:type==='adset'?row?.adGroup:row?.adGroupAd?.ad;
 if(row&&String(entity?.id)!==id)throw new ApiError('Google devolvió otro recurso. No se importaron resultados.',502);
 return {name:String(entity?.name||id),status:String(type==='ad'?row?.adGroupAd?.status||'':entity?.status||''),metrics:rows.length?googleMetrics(rows[0].metrics||{},id,account.currency,period.since,period.until):[],fetched_at:new Date().toISOString(),account};
}

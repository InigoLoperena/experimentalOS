import {experimentCampaignName} from './campaign-name';
import {ApiError} from './server-access';
import {executionFromFields} from './execution-plan';
import {parseGoogleAdsOptions} from './google-ads-options';
import {googleId,googleSearch,type GoogleAdsConnection,type GoogleAdsAccount} from './google-ads';
import type {Item} from './model';
import type {Variant} from './monitoring';
export type GoogleRecipe={name:string;account_id:string;currency:string;daily:number;start:string;end:string|null;countries:string[];languages:string[];keywords:string[];cpc:number;match:string;variants:{id:string;label:string;headlines:string[];descriptions:string[]}[];destination:string;revision:string;connection_revision:string};
function assets(text:string|null,min:number,max:number,length:number,label:string){const rows=(text||'').split('\n').map(s=>s.trim()).filter(Boolean);if(rows.length<min||rows.length>max||rows.some(s=>Array.from(s).length>length||/[\r\x00]/.test(s))||new Set(rows.map(s=>s.toLocaleLowerCase())).size!==rows.length)throw new ApiError(`${label}: escribe ${min}–${max} textos distintos, uno por línea, de hasta ${length} caracteres.`,400);return rows;}
export function googleRecipe(e:Item,code:string,variants:Variant[],connection:GoogleAdsConnection&{revision:string},account:GoogleAdsAccount,now=Date.now()):GoogleRecipe{
 const p=executionFromFields(e.fields),o=parseGoogleAdsOptions(p?.google);
 if(e.fields.channel!=='google_ads'||!p||!o||o.type!=='SEARCH')throw new ApiError('Guarda una ficha de Google Ads de Búsqueda.',400);
 if(o.eu_political!==false)throw new ApiError('Esta preparación requiere confirmar que no contiene publicidad política de la UE.',400);
 if(!p.destination||!p.daily_budget||(p.currency!==null&&p.currency!==account.currency)||!o.countries.length||!o.language_ids.length||!o.keywords.length||!o.cpc_limit)throw new ApiError('Indica en el prompt enlace, presupuesto diario, países, idioma, palabras clave y límite de CPC. La moneda debe coincidir con la cuenta.',400);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:account.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));const start=String(e.fields.start||today);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(Date.parse(start))||new Date(start).toISOString().slice(0,10)!==start||start<today)throw new ApiError('Selecciona una fecha de inicio actual o futura en la zona horaria de la cuenta.',400);
 if(p.variants.length!==2)throw new ApiError('Prepara dos variantes para esta primera integración de Búsqueda.',400);
 const prepared=p.variants.map(v=>{const actual=variants.filter(x=>x.label.trim().toLowerCase()===v.label.trim().toLowerCase());if(actual.length!==1)throw new ApiError('Guarda la ficha para sincronizar sus variantes.',400);return {id:actual[0].id,label:v.label,headlines:assets(v.headline,3,15,30,`Titulares de ${v.label}`),descriptions:assets(v.body,2,4,90,`Descripciones de ${v.label}`)};});
 const end=p.duration_days?new Date(Date.parse(start)+(p.duration_days-1)*86400000).toISOString().slice(0,10):null;
 return {name:experimentCampaignName(e.title),account_id:connection.customerId,currency:account.currency,daily:p.daily_budget,start,end,countries:o.countries,languages:o.language_ids,keywords:o.keywords,cpc:o.cpc_limit,match:o.match_type,variants:prepared,destination:p.destination,revision:e.updated_at,connection_revision:connection.revision};
}
export async function googleOperations(c:GoogleAdsConnection,token:string,r:GoogleRecipe,fetcher:typeof fetch=fetch){
 const countryRows=await googleSearch(c,token,`SELECT geo_target_constant.id, geo_target_constant.country_code FROM geo_target_constant WHERE geo_target_constant.country_code IN (${r.countries.map(v=>`'${v}'`).join(',')}) AND geo_target_constant.target_type = 'Country' AND geo_target_constant.status = 'ENABLED'`,fetcher);
 const locations=r.countries.map(country=>{const found=countryRows.filter(v=>v.geoTargetConstant?.countryCode===country);if(found.length!==1)throw new ApiError(`Google no confirmó el país ${country}.`,400);return googleId(String(found[0].geoTargetConstant.id));});
 const languageRows=await googleSearch(c,token,`SELECT language_constant.id, language_constant.name FROM language_constant WHERE language_constant.id IN (${r.languages.join(',')})`,fetcher);
 if(r.languages.some(id=>!languageRows.some(v=>String(v.languageConstant?.id)===id)))throw new ApiError('Google no confirmó los idiomas seleccionados.',400);
 const base=`customers/${googleId(c.customerId)}`,budget=`${base}/campaignBudgets/-1`,campaign=`${base}/campaigns/-2`,group=`${base}/adGroups/-3`;
 const operations:Record<string,unknown>[]=[
  {campaignBudgetOperation:{create:{resourceName:budget,name:r.name,amountMicros:String(Math.round(r.daily*1e6)),deliveryMethod:'STANDARD',explicitlyShared:false}}},
  {campaignOperation:{create:{resourceName:campaign,name:r.name,status:'PAUSED',advertisingChannelType:'SEARCH',campaignBudget:budget,targetSpend:{cpcBidCeilingMicros:String(Math.round(r.cpc*1e6))},containsEuPoliticalAdvertising:'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',startDateTime:`${r.start} 00:00:00`,...(r.end?{endDateTime:`${r.end} 23:59:59`}:{}),networkSettings:{targetGoogleSearch:true,targetSearchNetwork:false,targetContentNetwork:false,targetPartnerSearchNetwork:false},geoTargetTypeSetting:{positiveGeoTargetType:'PRESENCE'}}}},
  {adGroupOperation:{create:{resourceName:group,campaign,name:r.name,status:'PAUSED',type:'SEARCH_STANDARD'}}},
  ...r.variants.map(v=>({adGroupAdOperation:{create:{adGroup:group,status:'PAUSED',ad:{finalUrls:[r.destination],responsiveSearchAd:{headlines:v.headlines.map(text=>({text})),descriptions:v.descriptions.map(text=>({text}))}}}}})),
  ...locations.map(id=>({campaignCriterionOperation:{create:{campaign,location:{geoTargetConstant:`geoTargetConstants/${id}`}}}})),
  ...r.languages.map(id=>({campaignCriterionOperation:{create:{campaign,language:{languageConstant:`languageConstants/${id}`}}}})),
  ...r.keywords.map(text=>({adGroupCriterionOperation:{create:{adGroup:group,status:'ENABLED',keyword:{text,matchType:r.match}}}})),
 ];
 return operations;
}
export class GoogleMutationError extends ApiError{constructor(message:string,public uncertain:boolean){super(message,502);}}
export async function googleMutate(c:GoogleAdsConnection,token:string,operations:Record<string,unknown>[],validateOnly:boolean,fetcher:typeof fetch=fetch){
 let response;try{response=await fetcher(`https://googleads.googleapis.com/v25/customers/${googleId(c.customerId)}/googleAds:mutate`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(c.loginCustomerId?{'login-customer-id':googleId(c.loginCustomerId)}:{})},body:JSON.stringify({mutateOperations:operations,partialFailure:false,validateOnly,responseContentType:'RESOURCE_NAME_ONLY'}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw new GoogleMutationError(validateOnly?'Google no respondió a la validación. No se crearon recursos.':'No se pudo confirmar el envío. Comprueba Google Ads antes de repetirlo.',!validateOnly);}
 const result=await response.json().catch(()=>null);
 if(!response.ok||result?.error){const codes=(result?.error?.details||[]).flatMap((d:{errors?:{errorCode?:Record<string,string>}[]})=>d.errors||[]).flatMap((e:{errorCode?:Record<string,string>})=>Object.values(e.errorCode||{})).filter((s:unknown)=>typeof s==='string'&&/^[A-Z0-9_]+$/.test(s)).slice(0,5);throw new GoogleMutationError(`Google rechazó la ${validateOnly?'validación':'creación'}${codes.length?`: ${codes.join(', ')}`:'. Revisa cuenta, permisos y parámetros.'}`,!validateOnly&&(response.status>=500||response.status===408));}
 if(!result||result.partialFailureError)throw new GoogleMutationError('Google devolvió una respuesta inesperada. Revisa la cuenta antes de repetir.',!validateOnly);
 if(validateOnly)return [];
 const rows=result.mutateOperationResponses;
 if(!Array.isArray(rows)||rows.length!==operations.length)throw new GoogleMutationError('Google no confirmó todos los recursos. No repitas el envío.',true);
 return rows as Record<string,{resourceName:string}>[];
}
export function googleCreated(rows:Record<string,{resourceName:string}>[],r:GoogleRecipe){
 const read=(index:number,key:string,pattern:string)=>{const v=rows[index]?.[key]?.resourceName;const m=typeof v==='string'&&v.match(new RegExp(`^customers/${googleId(r.account_id)}/${pattern}$`));if(!m)throw new GoogleMutationError('Google no confirmó los IDs esperados. No repitas el envío.',true);return m[m.length-1];};
 return [{type:'campaign',id:read(1,'campaignResult','campaigns/(\\d+)'),variant:null,label:r.name},{type:'adset',id:read(2,'adGroupResult','adGroups/(\\d+)'),variant:null,label:r.name},...r.variants.map((v,i)=>({type:'ad',id:read(3+i,'adGroupAdResult','adGroupAds/\\d+~(\\d+)'),variant:v.id,label:v.label}))];
}

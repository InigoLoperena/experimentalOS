import {createHash} from 'node:crypto';
import type {Item} from './model';
import {executionFromFields} from './execution-plan';
import {posthogChannels} from './posthog-options';
import {ApiError} from './server-access';
import {posthogHost,posthogIdentifier,posthogJson,PostHogError} from './posthog-api';
export type PosthogConnection={host:string;projectId:string;key:string};
export function posthogFlagKey(id:string){if(!/^[a-f0-9-]{36}$/i.test(id))throw new ApiError('Experimento inválido.',400);return `xperiments-${id.toLowerCase()}`;}
export function posthogDigest(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export class PosthogWriteError extends PostHogError{constructor(message:string,public uncertain:boolean,status=502){super(message,status);}}
export async function posthogWrite(c:PosthogConnection,payload:unknown,fetcher:typeof fetch=fetch){
 let response:Response;
 try{response=await fetcher(`${posthogHost(c.host)}/api/projects/${posthogIdentifier(c.projectId)}/experiments/`,{method:'POST',headers:{Authorization:`Bearer ${c.key}`,'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});}
 catch{throw new PosthogWriteError('PostHog no confirmó el envío. Actualiza el estado antes de repetirlo.',true);}
 let result;try{result=await response.json();}catch{throw new PosthogWriteError('PostHog no confirmó una respuesta válida. Actualiza el estado antes de repetirlo.',response.ok||response.status>=500);}
 if(!response.ok)throw new PosthogWriteError(response.status===401||response.status===403?'PostHog rechazó el acceso. Revisa experiment:write y los permisos para crear feature flags en Integraciones.':'PostHog rechazó la preparación. Revisa las variantes y la métrica; la ficha se conserva.',response.status>=500||response.status===408, response.status===401||response.status===403?403:502);
 return result;
}
export async function posthogEvents(c:PosthogConnection,search='',fetcher:typeof fetch=fetch):Promise<string[]>{
 const payload=await posthogJson(`${posthogHost(c.host)}/api/projects/${posthogIdentifier(c.projectId)}/event_definitions/?limit=100${search?`&search=${encodeURIComponent(search)}`:''}`,c.key,fetcher);
 if(!Array.isArray(payload?.results))throw new PostHogError('No se pudieron leer los eventos de PostHog.');
 return payload.results.map((r:{name?:unknown})=>r?.name).filter((name:unknown):name is string=>typeof name==='string').slice(0,100);
}
export async function posthogRecipe(experiment:Item,c:PosthogConnection,fetcher:typeof fetch=fetch){
 if(!posthogChannels.includes(String(experiment.fields.channel)))throw new ApiError('Selecciona PostHog o un canal de producto.',400);
 const plan=executionFromFields(experiment.fields);
 if(!plan||plan.variants.length!==2)throw new ApiError('Prepara con IA las dos variantes A/B antes de enviar a PostHog.',400);
 let allocations=plan.variants.map(v=>v.allocation);
 if(allocations.every(v=>v===null))allocations=[50,50];
 else if(allocations.filter(v=>v===null).length===1){const i=allocations.findIndex(v=>v===null);allocations[i]=100-allocations[1-i]!;}
 const percentages=allocations.map(v=>Number(v));
 if(percentages.some(v=>!Number.isInteger(v)||v<1||v>99)||percentages[0]+percentages[1]!==100)throw new ApiError('El reparto de las dos variantes debe sumar 100 % en porcentajes enteros positivos. Corrígelo mediante el prompt.',400);
 const options=plan.posthog,notes:string[]=[];let metrics:Record<string,unknown>[]=[];
 if(options?.metric_event){
  try{
   const events=await posthogEvents(c,options.metric_event,fetcher);
   if(events.includes(options.metric_event)){
    const source={kind:'EventsNode',event:options.metric_event};
    metrics=[{kind:'ExperimentMetric',name:String(experiment.fields.metric||options.metric_event),metric_type:options.metric_type||'funnel',...(options.metric_type==='mean'?{source:{...source,math:'total'}}:{series:[source],conversion_window:options.window_days||14,conversion_window_unit:'day'})}];
   }else notes.push(`El evento «${options.metric_event}» no aparece confirmado en PostHog. La métrica queda pendiente de revisión; el borrador puede crearse.`);
  }catch{notes.push('No se pudieron comprobar los eventos. La métrica queda pendiente en el borrador; revisa event_definition:read.');}
 }else notes.push('Métrica pendiente: indica en el prompt el evento real de PostHog o complétala allí antes de activar.');
 const variants=plan.variants.map((v,i)=>({key:i===0?'control':'test',name:v.label,rollout_percentage:percentages[i]}));
 const description=[`Creado desde Xperiments · ${experiment.id}`,`Contexto: ${experiment.fields.context||''}`,`Hipótesis: ${experiment.fields.hypothesis||''}`,`Métrica propuesta: ${experiment.fields.metric||''}`,`Criterio de éxito: ${experiment.fields.success_criteria||'Pendiente de revisión'}`,...plan.variants.map((v,i)=>`${variants[i].key} · ${v.label}\n${[v.description,v.headline,v.body,v.call_to_action].filter(Boolean).join('\n')}`)].join('\n\n');
 const payload={name:`Experimento · ${experiment.title}`,description,type:'product',start_date:null,end_date:null,feature_flag_key:posthogFlagKey(experiment.id),feature_flag:{filters:{groups:[{properties:[],rollout_percentage:options?.rollout_percentage??100}],multivariate:{variants}}},...(metrics.length?{metrics}:{})};
 return {payload,notes};
}
export function verifiedPosthogDraft(detail:any,key:string,expected?:{groups:{rollout_percentage:number}[];multivariate:{variants:{key:string;rollout_percentage:number}[]}}){
 if(!detail||!Number.isSafeInteger(detail.id)||detail.id<1||detail.feature_flag_key!==key||detail.start_date||detail.feature_flag?.active!==false||detail.feature_flag?.key!==key||detail.feature_flag?.id==null)throw new PosthogWriteError('El recurso no se confirmó como borrador con la feature flag desactivada. Comprueba PostHog; no repitas el envío.',true);
 if(expected){
  const filters=detail.feature_flag.filters,variants=filters?.multivariate?.variants;
  if(!Array.isArray(variants)||variants.length!==expected.multivariate.variants.length||expected.multivariate.variants.some(v=>!variants.some((actual:any)=>actual.key===v.key&&actual.rollout_percentage===v.rollout_percentage))||filters?.groups?.[0]?.rollout_percentage!==expected.groups[0].rollout_percentage)throw new PosthogWriteError('PostHog creó el borrador, pero no confirmó el reparto solicitado. Actualiza el estado y revisa la configuración allí; no repitas el envío.',true);
 }
 return detail;
}

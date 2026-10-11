import {createHash} from 'node:crypto';
import type {Item} from './model';
import {executionFromFields} from './execution-plan';
import {ApiError} from './server-access';
import type {MetaConnection} from './meta-ads';

// First write operation: an empty paused traffic campaign. No ad, budget or
// activation endpoint is exposed. Ad sets and creatives require a later review.
export function pausedCampaign(experiment:Item,code:string,category:unknown){
  const plan=executionFromFields(experiment.fields);
  if(experiment.kind!=='experiment'||experiment.fields.channel!=='meta_ads'||plan?.goal!=='traffic')
    throw new ApiError('Esta primera preparación de Meta admite tráfico a una web. Revisa el canal y el objetivo.',400);
  if(category!=='NONE')throw new ApiError('Confirma que la campaña no pertenece a una categoría publicitaria especial. Las categorías especiales requieren una preparación específica.',400);
  if(!/^EXP-[A-Z0-9-]{1,100}$/.test(code))throw new ApiError('El experimento no tiene un identificador válido.',400);
  return {name:`${code} · ${experiment.title}`.slice(0,200),objective:'OUTCOME_TRAFFIC',status:'PAUSED',special_ad_categories:[] as string[],is_adset_budget_sharing_enabled:false};
}
export function campaignFingerprint(payload:ReturnType<typeof pausedCampaign>,revision:string){
  return createHash('sha256').update(JSON.stringify({payload,revision})).digest('hex');
}
export class MetaCreationError extends ApiError{
  constructor(message:string,public uncertain:boolean){super(message,502);}
}
export async function createPausedCampaign(connection:MetaConnection,payload:ReturnType<typeof pausedCampaign>,fetcher:typeof fetch=fetch){
  if(!/^\d{1,30}$/.test(connection.accountId)||payload.status!=='PAUSED'||payload.objective!=='OUTCOME_TRAFFIC'||payload.special_ad_categories.length)
    throw new ApiError('La configuración de Meta no es válida.',400);
  // Rebuild an allowlist rather than transmitting arbitrary caller parameters.
  const body=new URLSearchParams({name:payload.name,objective:'OUTCOME_TRAFFIC',status:'PAUSED',special_ad_categories:'[]',is_adset_budget_sharing_enabled:'false'});
  let response:Response;
  try{response=await fetcher(`https://graph.facebook.com/v26.0/act_${connection.accountId}/campaigns`,{method:'POST',headers:{Authorization:`Bearer ${connection.token}`,'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}
  catch{throw new MetaCreationError('Meta no confirmó el resultado. No repitas la creación: revisa Ads Manager y vincula la campaña si aparece.',true);}
  let result:Record<string,unknown>;
  try{result=await response.json();}catch{throw new MetaCreationError('Meta devolvió una respuesta incompleta. Revisa Ads Manager antes de volver a crear.',true);}
  if(!result||typeof result!=='object'||Array.isArray(result))throw new MetaCreationError('Meta no confirmó el resultado. Revisa Ads Manager.',true);
  if(!response.ok||result.error){
    const code=(result.error as {code?:number}|undefined)?.code;
    throw new MetaCreationError(code===190?'Renueva el token de escritura de Meta.': 'Meta rechazó la creación. Revisa ads_management y el acceso a la cuenta. No se activó ninguna campaña.',response.status>=500||!result.error);
  }
  if(typeof result.id!=='string'||!/^\d{1,30}$/.test(result.id))throw new MetaCreationError('Meta no devolvió el ID de la campaña. Revisa Ads Manager antes de repetir.',true);
  return result.id;
}

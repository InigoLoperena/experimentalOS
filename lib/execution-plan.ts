import type { Fields } from './model';
import {posthogOptionsSchema,parsePosthogOptions,type PosthogOptions} from './posthog-options';
import {googlePlaySchema,parseGooglePlay,type GooglePlayOptions} from './google-play-options';
import {metaOptionsSchema,parseMetaOptions,type MetaOptions} from './meta-options';
import {googleCampaignTypes,googleAdsOptionsSchema,parseGoogleAdsOptions,type GoogleAdsOptions} from './google-ads-options';

export const channels = {
  posthog:'PostHog · Experimento A/B', web_app:'Web app', mobile_ios:'App móvil · iOS', mobile_android:'App móvil · Android',
  app_store:'Ficha de App Store · iOS', google_play:'Ficha de Google Play · Android',
  meta_ads:'Meta Ads', google_ads:'Google Ads', metricool:'Metricool', smartlead:'Smartlead',
  linkedin_ads:'LinkedIn Ads', tiktok_ads:'TikTok Ads', other:'Otro canal',
} as const;
export type Channel = keyof typeof channels;
export const goals = {traffic:'Tráfico',installs:'Instalaciones',leads:'Contactos o registros',sales:'Ventas o conversiones',engagement:'Interacción',product:'Comportamiento de producto',store:'Conversión de la ficha de la app'} as const;
export type ExecutionPlan = {
  posthog?:PosthogOptions|null;
  play?:GooglePlayOptions|null;
  meta?:MetaOptions|null;
  google?:GoogleAdsOptions|null;
  goal:keyof typeof goals|null; destination:string|null; audience:string|null; location:string|null;
  daily_budget:number|null; currency:string|null; duration_days:number|null;
  variants:{label:string;description:string|null;headline:string|null;body:string|null;call_to_action:string|null;allocation:number|null;media_names?:string[]}[];
};
export const executionTextLimits={destination:2000,currency:3,audience:4000,location:4000,label:40,description:4000,headline:300,body:4000,call_to_action:120} as const;
const text=(maxLength:number)=>({type:['string','null'],maxLength});
export const executionSchema={type:'object',additionalProperties:false,required:['goal','destination','audience','location','daily_budget','currency','duration_days','variants','meta','google','play','posthog'],properties:{
  posthog:{anyOf:[posthogOptionsSchema,{type:'null'}]},
  play:{anyOf:[googlePlaySchema,{type:'null'}]},
  google:{anyOf:[googleAdsOptionsSchema,{type:'null'}]},
  meta:{anyOf:[metaOptionsSchema,{type:'null'}]},
  goal:{type:['string','null'],enum:[...Object.keys(goals),null]},destination:text(executionTextLimits.destination),audience:text(executionTextLimits.audience),location:text(executionTextLimits.location),
  daily_budget:{type:['number','null'],minimum:0,maximum:1000000},currency:text(executionTextLimits.currency),duration_days:{type:['integer','null'],minimum:1,maximum:365},
  variants:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,required:['label','description','headline','body','call_to_action','allocation','media_names'],properties:{label:{type:'string',minLength:1,maxLength:executionTextLimits.label},description:text(executionTextLimits.description),headline:text(executionTextLimits.headline),body:text(executionTextLimits.body),call_to_action:text(executionTextLimits.call_to_action),allocation:{type:['number','null']},media_names:{type:'array',maxItems:4,items:{type:'string',maxLength:250}}}}},
}};
export function parseChannel(value:unknown):Channel|null {
  if(value===null || value===undefined || value==='') return null;
  if(typeof value!=='string' || !Object.hasOwn(channels,value)) throw new Error('Selecciona un canal válido.');
  return value as Channel;
}
export function emptyExecution():ExecutionPlan {
  return {goal:null,destination:null,audience:null,location:null,daily_budget:null,currency:null,duration_days:null,variants:[]};
}
export function executionDestination(value:string|null):string|null {
  const input=value?.trim();
  if(!input)return null;
  // Accept a pasted domain, but never reinterpret protocols, credentials or relative paths as destinations.
  const bareDomain=/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}(?:[/?#]|$)/i.test(input);
  try {
    if(/\s/.test(input))throw new Error();
    const url=new URL(bareDomain?`https://${input}`:input);
    if(url.protocol!=='https:'||url.username||url.password||!url.hostname)throw new Error();
    return url.href;
  }catch{throw new Error('Revisa la URL de destino: escribe un dominio como greenhunt.net o una dirección HTTPS completa, sin espacios ni credenciales.');}
}
export function parseExecution(value:unknown):ExecutionPlan {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('La configuración del experimento no es válida.');
  const row=value as ExecutionPlan;
  const nullableText=(input:unknown,max=4000,label='Texto')=>{if(input===null)return null;if(typeof input!=='string')throw new Error(`${label}: debe ser texto o quedar pendiente.`);if(input.length>max)throw new Error(`${label}: admite hasta ${max} caracteres; se recibieron ${input.length}.`);return input;};
  const bounded=(input:unknown,min:number,max:number,integer=false)=>{if(input===null)return null;if(typeof input!=='number'||!Number.isFinite(input)||input<min||input>max||(integer&&!Number.isInteger(input)))throw new Error('Revisa el presupuesto, duración y reparto de variantes.');return input;};
  if(row.goal!==null && !(typeof row.goal==='string' && Object.hasOwn(goals,row.goal))) throw new Error('El objetivo de ejecución no es válido.');
  const destination=executionDestination(nullableText(row.destination,executionTextLimits.destination,'Enlace de destino'));
  const currency=nullableText(row.currency,executionTextLimits.currency,'Divisa');if(currency && !/^[A-Z]{3}$/.test(currency))throw new Error('Usa una moneda de tres letras, como USD o EUR.');
  if(!Array.isArray(row.variants)||row.variants.length>6) throw new Error('Prepara hasta seis variantes por experimento.');
  const variants=row.variants.map((v,index)=>{
    if(v.media_names!==undefined&&(!Array.isArray(v.media_names)||v.media_names.length>4||v.media_names.some(n=>typeof n!=='string'||n.length>250)))throw new Error('Revisa los nombres de materiales de las variantes.');
    return {label:(nullableText(v.label,executionTextLimits.label,`Nombre de variante ${index+1}`) || '').trim(),description:nullableText(v.description,executionTextLimits.description,`Descripción de variante ${index+1}`),headline:nullableText(v.headline,executionTextLimits.headline,`Titular de variante ${index+1}`),body:nullableText(v.body,executionTextLimits.body,`Texto de variante ${index+1}`),call_to_action:nullableText(v.call_to_action,executionTextLimits.call_to_action,`Llamada a la acción de variante ${index+1}`),allocation:bounded(v.allocation,0,100),...(v.media_names!==undefined?{media_names:v.media_names}:{})};
  });
  if(variants.some(v=>!v.label.trim())||new Set(variants.map(v=>v.label.trim().toLowerCase())).size!==variants.length)throw new Error('Cada variante necesita un nombre distinto.');
  if(variants.every(v=>v.allocation!==null)&&variants.length && Math.abs(variants.reduce((sum,v)=>sum+v.allocation!,0)-100)>0.01)throw new Error('El reparto completo de las variantes debe sumar 100%.');
  return {...(row.posthog!==undefined?{posthog:parsePosthogOptions(row.posthog)}:{}),...(row.play!==undefined?{play:parseGooglePlay(row.play)}:{}),goal:row.goal,destination,audience:nullableText(row.audience,executionTextLimits.audience,'Audiencia'),location:nullableText(row.location,executionTextLimits.location,'Ubicación'),daily_budget:bounded(row.daily_budget,0,1000000),currency,duration_days:bounded(row.duration_days,1,365,true),variants,...(row.meta!==undefined?{meta:parseMetaOptions(row.meta)}:{}),...(row.google!==undefined?{google:parseGoogleAdsOptions(row.google)}:{})};
}
export function executionFromFields(fields:Fields):ExecutionPlan|null {
  if(!fields.execution_config)return null;
  return parseExecution(JSON.parse(String(fields.execution_config)));
}
export function executionSummary(channel:Channel|null,plan:ExecutionPlan):string {
  return [`Canal: ${channel?channels[channel]:'Pendiente'}`,...(channel==='meta_ads'?[`Objetivo en Meta: ${plan.meta?.objective||'Pendiente'}`,`Enlace del anuncio: ${plan.destination||'Pendiente'}`,`Inversión diaria en Meta: ${plan.daily_budget??'Pendiente'} ${plan.currency||''}`,`Días de campaña en Meta: ${plan.duration_days??'Pendiente'}`]:[]),...(channel==='google_ads'?[`Tipo: ${plan.google?.type?googleCampaignTypes[plan.google.type]:'Pendiente'}`,`Enlace: ${plan.destination||'Pendiente'}`,`Presupuesto diario medio: ${plan.daily_budget??'Pendiente'} ${plan.currency||''}`,`Duración: ${plan.duration_days??'Pendiente'} días`,`Países: ${plan.google?.countries.join(', ')||'Pendiente'}`,`Palabras clave: ${plan.google?.keywords.join(', ')||'Pendiente'}`,`Puja: ${plan.google?.type==='DISPLAY'?'CPC manual':'Maximizar clics'}; CPC máximo ${plan.google?.cpc_limit??'Pendiente'}`,`Google optimiza la rotación; no se aplica un reparto aleatorio 50/50.`]:[]),...plan.variants.map(v=>`\nVariante ${v.label} (${v.allocation??'pendiente'}%): ${v.description||''}\nTitular: ${v.headline||'Pendiente'}\nTexto: ${v.body||'Pendiente'}\nCTA: ${v.call_to_action||'Pendiente'}`)].join('\n');
}

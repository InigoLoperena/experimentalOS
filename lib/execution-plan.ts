import type { Fields } from './model';

export const channels = {
  web_app:'Web app', mobile_ios:'App móvil · iOS', mobile_android:'App móvil · Android',
  app_store:'Ficha de App Store · iOS', google_play:'Ficha de Google Play · Android',
  meta_ads:'Meta Ads', google_ads:'Google Ads', metricool:'Metricool', smartlead:'Smartlead',
  linkedin_ads:'LinkedIn Ads', tiktok_ads:'TikTok Ads', other:'Otro canal',
} as const;
export type Channel = keyof typeof channels;
export const goals = {traffic:'Tráfico',installs:'Instalaciones',leads:'Contactos o registros',sales:'Ventas o conversiones',engagement:'Interacción',product:'Comportamiento de producto',store:'Conversión de la ficha de la app'} as const;
export type ExecutionPlan = {
  goal:keyof typeof goals|null; destination:string|null; audience:string|null; location:string|null;
  daily_budget:number|null; currency:string|null; duration_days:number|null;
  variants:{label:string;description:string|null;headline:string|null;body:string|null;call_to_action:string|null;allocation:number|null}[];
};
const text={type:['string','null']};
export const executionSchema={type:'object',additionalProperties:false,required:['goal','destination','audience','location','daily_budget','currency','duration_days','variants'],properties:{
  goal:{type:['string','null'],enum:[...Object.keys(goals),null]},destination:text,audience:text,location:text,
  daily_budget:{type:['number','null']},currency:text,duration_days:{type:['integer','null']},
  variants:{type:'array',items:{type:'object',additionalProperties:false,required:['label','description','headline','body','call_to_action','allocation'],properties:{label:{type:'string'},description:text,headline:text,body:text,call_to_action:text,allocation:{type:['number','null']}}}},
}};
export function parseChannel(value:unknown):Channel|null {
  if(value===null || value===undefined || value==='') return null;
  if(typeof value!=='string' || !(value in channels)) throw new Error('Selecciona un canal válido.');
  return value as Channel;
}
export function emptyExecution():ExecutionPlan {
  return {goal:null,destination:null,audience:null,location:null,daily_budget:null,currency:null,duration_days:null,variants:[]};
}
export function parseExecution(value:unknown):ExecutionPlan {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('La configuración del experimento no es válida.');
  const row=value as ExecutionPlan;
  const nullableText=(input:unknown,max=4000)=>{if(input===null)return null;if(typeof input!=='string' || input.length>max)throw new Error('Revisa los textos de la configuración.');return input;};
  const bounded=(input:unknown,min:number,max:number,integer=false)=>{if(input===null)return null;if(typeof input!=='number'||!Number.isFinite(input)||input<min||input>max||(integer&&!Number.isInteger(input)))throw new Error('Revisa el presupuesto, duración y reparto de variantes.');return input;};
  if(row.goal!==null && !(typeof row.goal==='string' && row.goal in goals)) throw new Error('El objetivo de ejecución no es válido.');
  const destination=nullableText(row.destination,2000);
  if(destination){const url=new URL(destination);if(url.protocol!=='https:'||url.username||url.password)throw new Error('La URL de destino debe usar HTTPS sin credenciales.');}
  const currency=nullableText(row.currency,3);if(currency && !/^[A-Z]{3}$/.test(currency))throw new Error('Usa una moneda de tres letras, como USD o EUR.');
  if(!Array.isArray(row.variants)||row.variants.length>6) throw new Error('Prepara hasta seis variantes por experimento.');
  const variants=row.variants.map(v=>({label:nullableText(v.label,40) || '',description:nullableText(v.description),headline:nullableText(v.headline,300),body:nullableText(v.body),call_to_action:nullableText(v.call_to_action,120),allocation:bounded(v.allocation,0,100)}));
  if(variants.some(v=>!v.label.trim())||new Set(variants.map(v=>v.label.trim().toLowerCase())).size!==variants.length)throw new Error('Cada variante necesita un nombre distinto.');
  if(variants.every(v=>v.allocation!==null)&&variants.length && Math.abs(variants.reduce((sum,v)=>sum+v.allocation!,0)-100)>0.01)throw new Error('El reparto completo de las variantes debe sumar 100%.');
  return {goal:row.goal,destination,audience:nullableText(row.audience),location:nullableText(row.location),daily_budget:bounded(row.daily_budget,0,1000000),currency,duration_days:bounded(row.duration_days,1,365,true),variants};
}
export function executionFromFields(fields:Fields):ExecutionPlan|null {
  if(!fields.execution_config)return null;
  return parseExecution(JSON.parse(String(fields.execution_config)));
}
export function executionSummary(channel:Channel|null,plan:ExecutionPlan):string {
  return [`Canal: ${channel?channels[channel]:'Pendiente'}`,`Objetivo: ${plan.goal?goals[plan.goal]:'Pendiente'}`,`Destino: ${plan.destination||'Pendiente'}`,`Audiencia: ${plan.audience||'Pendiente'}`,`Ubicación: ${plan.location||'Pendiente'}`,`Presupuesto diario total: ${plan.daily_budget??'Pendiente'} ${plan.currency||''}`,`Duración: ${plan.duration_days??'Pendiente'} días`,...plan.variants.map(v=>`\nVariante ${v.label} (${v.allocation??'pendiente'}%): ${v.description||''}\nTitular: ${v.headline||'Pendiente'}\nTexto: ${v.body||'Pendiente'}\nCTA: ${v.call_to_action||'Pendiente'}`)].join('\n');
}

import type { Fields } from './model';
import {channels,executionSchema,parseChannel,parseExecution,executionFromFields,type Channel,type ExecutionPlan} from './execution-plan';

export const preparationKeys = ['context','hypothesis','metric','success_criteria','start','tags','secondary_metrics','audience','traffic_plan','risks'] as const;
export type Preparation = { title: string; fields: Record<typeof preparationKeys[number], string | null>; missing: string[]; assumptions: string[]; questions?:string[]; recommendations?:string[]; channel?:Channel|null; execution?:ExecutionPlan|null };
const text = { type: ['string','null'],maxLength:5000 };
const listSchema={type:'array',maxItems:20,items:{type:'string',maxLength:1000}};
export const preparationSchema = { type:'object',additionalProperties:false,required:['title','fields','missing','assumptions','channel','execution','questions','recommendations'],properties:{
  questions:{...listSchema,maxItems:6},recommendations:listSchema,
  channel:{type:['string','null'],enum:[...Object.keys(channels),null]},execution:{anyOf:[executionSchema,{type:'null'}]},
  title:{type:'string',minLength:1,maxLength:300},fields:{type:'object',additionalProperties:false,required:[...preparationKeys],properties:Object.fromEntries(preparationKeys.map(key => [key,text]))},
  missing:listSchema,assumptions:listSchema,
} };
export const preparationRequestSchema = {...preparationSchema,properties:{...preparationSchema.properties,fields:{...preparationSchema.properties.fields,
  properties:{...preparationSchema.properties.fields.properties,success_criteria:{type:'null'}}}}};
export function preparationSchemaForRequest(channel:Channel|null,prompt:string){
  // Also recognize spoken Spanish transcriptions such as "testa B" and "test AB".
  const ab=channel==='meta_ads'&&(/\ba\s*[/\-]\s*b\b|\b(?:test|prueba|testa)\s*a?\s*b\b|\bdos\s+(?:variantes|anuncios)\b/i.test(prompt)||/\bun[oa]?\b[\s\S]*\botr[oa]\b/i.test(prompt));
  if(!ab)return preparationRequestSchema;
  const execution={...executionSchema,properties:{...executionSchema.properties,variants:{...executionSchema.properties.variants,minItems:2,maxItems:2}}};
  return {...preparationRequestSchema,properties:{...preparationRequestSchema.properties,execution:{anyOf:[execution,{type:'null'}]}}};
}
export function parsePreparation(value: unknown): Preparation {
  if (!value || typeof value!=='object') throw new Error('La IA no devolvió una propuesta válida.');
  const candidate=value as Preparation;
  if (typeof candidate.title!=='string' || !candidate.title.trim() || candidate.title.length>300 || !candidate.fields || Array.isArray(candidate.fields)) throw new Error('Revisa la propuesta de la IA.');
  const fields={} as Preparation['fields'];
  for (const key of preparationKeys) {
    const input=candidate.fields[key];
    if (input!==null && (typeof input!=='string' || input.length>5000)) throw new Error('La propuesta contiene un campo no válido.');
    fields[key]=input;
  }
  if (fields.start && (!/^\d{4}-\d{2}-\d{2}$/.test(fields.start) || Number.isNaN(Date.parse(fields.start)) || new Date(fields.start).toISOString().slice(0,10)!==fields.start)) throw new Error('La fecha propuesta no es válida.');
  const list=(input: unknown) => { if (!Array.isArray(input) || input.length>20 || input.some(row => typeof row!=='string' || row.length>1000)) throw new Error('Las aclaraciones de la IA no son válidas.'); return input as string[]; };
  const missing=list(candidate.missing);
  let execution=candidate.execution;
  // An inconsistent AI traffic split is an unanswered setting, not grounds to lose all valid copy.
  // Saved plans still use strict parseExecution validation; no percentages are silently invented.
  if(execution&&Array.isArray(execution.variants)&&execution.variants.length&&execution.variants.every(v=>v&&typeof v.allocation==='number'&&Number.isFinite(v.allocation)&&v.allocation>=0&&v.allocation<=100)&&Math.abs(execution.variants.reduce((sum,v)=>sum+v.allocation!,0)-100)>0.01){
    execution={...execution,variants:execution.variants.map(v=>({...v,allocation:null}))};
    missing.push('Confirma el reparto entre variantes: los porcentajes propuestos no sumaban 100 % y se han dejado pendientes.');
  }
  return {title:candidate.title.trim(),fields,missing:[...new Set(missing)].slice(0,20),assumptions:list(candidate.assumptions),questions:list(candidate.questions||[]).slice(0,6),recommendations:list(candidate.recommendations||[]),channel:parseChannel(candidate.channel),execution:execution==null?null:parseExecution(execution)};
}
export function applyPreparation(current: Fields, proposal: Preparation): Fields {
  // Null means unknown: never erase existing user values or change record identity/ownership.
  const next={...current,...Object.fromEntries(preparationKeys.filter(key => proposal.fields[key]!==null).map(key => [key,proposal.fields[key]!]))};
  if(proposal.channel && !current.channel)next.channel=proposal.channel;
  if(proposal.execution){
    const old=executionFromFields(current);
    const execution={...proposal.execution};
    if(old)for(const key of Object.keys(old) as (keyof ExecutionPlan)[])if(execution[key]===null || (key==='variants'&&!execution.variants.length))Object.assign(execution,{[key]:old[key]});
    if(old&&proposal.execution.variants.length)execution.variants=execution.variants.map(variant=>{
      const previous=old.variants.find(value=>value.label.trim().toLowerCase()===variant.label.trim().toLowerCase());
      if(!previous)return variant;
      return {...variant,...Object.fromEntries(Object.entries(variant).filter(([,value])=>value===null).map(([key])=>[key,previous[key as keyof typeof previous]]))};
    });
    next.execution_config=JSON.stringify(parseExecution(execution));
  }
  return next;
}

export function humanSuccessCriterion(proposal: Preparation, current: unknown): Preparation {
  const criterion=typeof current==='string' && current.trim() ? current : null;
  return {...proposal,fields:{...proposal.fields,success_criteria:criterion},missing:criterion ? proposal.missing : [...new Set([...proposal.missing,'Define el criterio de éxito y su umbral antes de ejecutar el experimento.'])]};
}

export function requiredPreparation(proposal:Preparation,mediaCount:number):Preparation{
  const missing=[...proposal.missing];const plan=proposal.execution;
  if(!proposal.channel)missing.push('Selecciona el canal principal.');
  if(!proposal.fields.hypothesis)missing.push('Revisa y define la hipótesis del experimento.');
  if(!proposal.fields.start)missing.push('Define la fecha de inicio antes de ejecutar.');
  if(!plan?.goal)missing.push('Confirma el objetivo de ejecución.');
  if(proposal.channel!=='google_play' && plan && ['traffic','installs','store'].includes(plan.goal||'')&&!plan.destination)missing.push('Añade la URL de destino o de la ficha de la app.');
  if(proposal.channel && ['meta_ads','google_ads','linkedin_ads','tiktok_ads'].includes(proposal.channel)){
    if(plan?.daily_budget===null||!plan)missing.push('Confirma el presupuesto diario total.');
    if(proposal.channel!=='meta_ads'&&!plan?.currency)missing.push('Confirma la moneda del presupuesto.');
    if(proposal.channel!=='meta_ads'&&!plan?.duration_days)missing.push('Confirma la duración.');
    if(!plan?.location)missing.push('Confirma la ubicación del público.');
    if(!mediaCount)missing.push('Adjunta y asigna las creatividades a las variantes.');
    if(!plan?.variants.length || plan.variants.some(v=>!v.headline||!v.body))missing.push('Completa titulares y textos de las variantes.');
    if(proposal.channel==='meta_ads')missing.push('Antes de crear en Meta: verificar la página, segmentación y permisos de escritura.');
  }
  return {...proposal,missing:[...new Set(missing)].slice(0,20)};
}

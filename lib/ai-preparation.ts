import type { Fields } from './model';

export const preparationKeys = ['context','hypothesis','metric','success_criteria','start','tags','secondary_metrics','audience','traffic_plan','risks'] as const;
export type Preparation = { title: string; fields: Record<typeof preparationKeys[number], string | null>; missing: string[]; assumptions: string[] };
const text = { type: ['string','null'] };
export const preparationSchema = { type:'object',additionalProperties:false,required:['title','fields','missing','assumptions'],properties:{
  title:{type:'string'},fields:{type:'object',additionalProperties:false,required:[...preparationKeys],properties:Object.fromEntries(preparationKeys.map(key => [key,text]))},
  missing:{type:'array',items:{type:'string'}},assumptions:{type:'array',items:{type:'string'}},
} };
export const preparationRequestSchema = {...preparationSchema,properties:{...preparationSchema.properties,fields:{...preparationSchema.properties.fields,
  properties:{...preparationSchema.properties.fields.properties,success_criteria:{type:'null'}}}}};
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
  return {title:candidate.title.trim(),fields,missing:list(candidate.missing),assumptions:list(candidate.assumptions)};
}
export function applyPreparation(current: Fields, proposal: Preparation): Fields {
  // Null means unknown: never erase existing user values or change record identity/ownership.
  return {...current,...Object.fromEntries(preparationKeys.filter(key => proposal.fields[key]!==null).map(key => [key,proposal.fields[key]!]))};
}

export function humanSuccessCriterion(proposal: Preparation, current: unknown): Preparation {
  const criterion=typeof current==='string' && current.trim() ? current : null;
  return {...proposal,fields:{...proposal.fields,success_criteria:criterion},missing:criterion ? proposal.missing : [...new Set([...proposal.missing,'Define el criterio de éxito y su umbral antes de ejecutar el experimento.'])]};
}

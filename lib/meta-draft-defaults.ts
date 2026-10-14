import type {Item} from './model';
import {emptyExecution,executionFromFields} from './execution-plan';
import {emptyMeta,type MetaOptions} from './meta-options';
import type {MetaSelection} from './meta-build';

export function metaDraftDefaults(experiment:Item,project:Item,selection:MetaSelection,connection:{currency?:string;pixelId?:string;pageId?:string}){
 const saved=executionFromFields(experiment.fields)||emptyExecution(),notes:string[]=[];
 const plan={...saved,variants:saved.variants.map(v=>({...v})),google:null};
 const meta:MetaOptions={...selection.meta,countries:[...selection.meta.countries],placements:[...selection.meta.placements]};
 if(!meta.objective){meta.objective=plan.goal==='engagement'?'engagement':plan.goal==='leads'?'leads':plan.goal==='sales'?'sales':'traffic';notes.push(`Se propone el objetivo ${meta.objective} para el borrador.`);}
 if(['leads','sales'].includes(meta.objective)&&(!connection.pixelId||!meta.conversion_event)){meta.objective='traffic';meta.conversion_event=null;notes.push('Sin píxel y evento verificados se prepara Tráfico. No optimiza ni mide registros o ventas; configura la medición antes de activarla si ese es tu objetivo.');}
 if(!meta.countries.length&&!meta.city_key){meta.countries=saved.google?.countries.length?[...saved.google.countries]:[connection.currency==='EUR'?'ES':connection.currency==='GBP'?'GB':'US'];notes.push(`Se propone público amplio en ${meta.countries.join(', ')}; revisa la ubicación en Meta antes de activar.`);}
 meta.age_min??=18;meta.age_max??=65;if(!meta.placements.length)meta.placements=['feed','story','reels'];
 if(plan.daily_budget===null){plan.daily_budget=10;notes.push(`Se propone un presupuesto de 10 ${connection.currency||plan.currency||'unidades de la cuenta'} al día, solo en recursos pausados. Revísalo antes de activar.`);}
 const isPlaceholder=(value:string|null)=>{if(!value)return true;try{const host=new URL(value).hostname;return /^(?:example\.(?:com|net|org)|localhost)$|\.(?:example\.(?:com|net|org)|example|invalid|test|localhost)$/i.test(host);}catch{return true;}};
 if(isPlaceholder(plan.destination)){
  const site=project.fields.site_url||project.fields.website||project.fields.url;
  if(typeof site==='string'&&site.trim()){try{const url=new URL(/^https:\/\//i.test(site.trim())?site.trim():`https://${site.trim()}`);if(url.protocol==='https:'&&!url.username&&!url.password&&!isPlaceholder(url.href))plan.destination=url.href;}catch{/* Use the verified Page when a project has no real website. */}}
  if(isPlaceholder(plan.destination)&&connection.pageId)plan.destination=`https://www.facebook.com/${connection.pageId}`;
  notes.push('Se usa el enlace real del proyecto o de su página de Facebook, en lugar de un enlace de ejemplo.');
 }
 for(const v of plan.variants){
  if(!v.headline)v.headline=project.title.slice(0,120);
  if(!v.body)v.body=v.description||`Descubre ${project.title}.`;
  if(!v.call_to_action)v.call_to_action='LEARN_MORE';
 }
 plan.meta=meta;
 return {experiment:{...experiment,fields:{...experiment.fields,execution_config:JSON.stringify(plan)}},selection:{...selection,meta},notes};
}

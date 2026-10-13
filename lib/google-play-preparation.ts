import type {Item} from './model';
import {executionFromFields} from './execution-plan';
import {playAssets,playMetrics} from './google-play-options';
// Portable local preparation, deliberately not an Android Publisher API payload.
export function googlePlayPreparation(experiment:Item,code:string){
 if(experiment.fields.channel!=='google_play')throw new Error('Selecciona el canal Google Play.');
 const plan=executionFromFields(experiment.fields),p=plan?.play;
 if(!p?.type||!p.language||!p.asset||!p.metric||p.audience===null)throw new Error('Completa tipo, idioma, elemento, métrica y audiencia en Editar ficha.');
 if(!plan||plan.variants.length<1||plan.variants.length>2)throw new Error('Prepara una o dos variantes nuevas; la ficha actual será el control.');
 const text=['short_description','full_description'].includes(p.asset);
 for(const v of plan.variants){
  if(text&&(!v.body?.trim()||v.body.length>(p.asset==='short_description'?80:4000)))throw new Error('Completa el texto: hasta 80 caracteres para descripción breve o 4000 para completa.');
  if(!text&&!v.media_names?.length)throw new Error('Asigna los nombres de los materiales a cada variante en Editar ficha.');
 }
 return {format:'xperiments-google-play-preparation-v1',code,name:`${code} ${experiment.title}`.slice(0,50),publication:'manual_in_play_console',control:'Ficha actual de la tienda',type:p.type,language:p.language,asset:playAssets[p.asset],metric:playMetrics[p.metric],experimental_audience:p.audience,
  hypothesis:String(experiment.fields.hypothesis||''),success_criterion:String(experiment.fields.success_criteria||''),
  variants:plan.variants.map((v,i)=>({label:v.label,reference:`${code}-PLAY-${i+1}`,text:text?v.body:null,materials:v.media_names||[]})),
  instructions:'Este archivo es una guía local, no se importa como test por la API. Crea el test en Play Console. Vincula un recurso por variante con su referencia e importa métricas manuales del mismo periodo. No equivale a un resultado estadísticamente validado.'};
}

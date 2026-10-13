import {createHash} from 'node:crypto';
import type {Item} from './model';
import {executionFromFields} from './execution-plan';
import {emptyMeta,parseMetaOptions,metaFormats,type MetaOptions} from './meta-options';
import type {Attachment} from './attachments';
import type {Variant} from './monitoring';
import {ApiError} from './server-access';

export type MetaSelection={name_mode?:'exact';mode:'campaign'|'adset'|'ad';parent_id:string|null;start_at:string|null;meta:MetaOptions;category:'NONE';assignments:{variant:string;placement:keyof typeof metaFormats;attachment_id:string;thumbnail_id:string|null;crop:'centre'|'attention'|'north'|'south'}[]};
export type MetaStep={key:string;kind:'campaign'|'image'|'video'|'thumbnail'|'adset'|'creative'|'ad';label:string;variant_id:string|null;placement?:keyof typeof metaFormats;attachment?:Attachment;crop?:MetaSelection['assignments'][number]['crop'];variant?:{label:string;headline:string;body:string;cta:string};budget?:number};
export type MetaRecipe={selection:MetaSelection;name:string;objective:string;optimization:string;destination:string;currency:string;total:number;budget_period?:'daily';start:string|null;end:string|null;page:string;instagram:string;pixel:string|null;steps:MetaStep[];revision:string;connection_revision:string;account_id:string};
export type MetaStepResult={id?:string;hash?:string};
export function digest(value:unknown){return createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value,(_key,current)=>current&&typeof current==='object'&&!Array.isArray(current)?Object.fromEntries(Object.keys(current).sort().map(key=>[key,current[key]])):current)).digest('hex');}
export function parseMetaSelection(raw:unknown):MetaSelection{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ApiError('Revisa las opciones de preparación.',400);
 const v=raw as MetaSelection;
 const meta=parseMetaOptions(v.meta);
 if(!meta||!['campaign','adset','ad'].includes(v.mode)||v.category!=='NONE')throw new ApiError('Confirma el modo y las categorías especiales.',400);
 if(v.mode==='campaign'?v.parent_id!==null:typeof v.parent_id!=='string'||!/^\d{1,30}$/.test(v.parent_id))throw new ApiError('Indica el ID del recurso padre de Meta.',400);
 if(!Array.isArray(v.assignments)||v.assignments.length>18)throw new ApiError('Asigna un material por variante y ubicación.',400);
 const assignments=v.assignments.map(a=>{
  if(!a||typeof a.variant!=='string'||a.variant.length>40||!Object.hasOwn(metaFormats,a.placement)||! /^[0-9a-f-]{36}$/i.test(a.attachment_id)||!(a.thumbnail_id===null||/^[0-9a-f-]{36}$/i.test(a.thumbnail_id))||!['centre','attention','north','south'].includes(a.crop))throw new ApiError('La asignación de materiales no es válida.',400);
  return {variant:a.variant,placement:a.placement,attachment_id:a.attachment_id,thumbnail_id:a.thumbnail_id,crop:a.crop};
 });
 if(v.start_at!==null&&(typeof v.start_at!=='string'||! /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.start_at)||!Number.isFinite(Date.parse(v.start_at))))throw new ApiError('Selecciona una fecha y hora válidas.',400);
 if(v.name_mode!==undefined&&v.name_mode!=='exact')throw new ApiError('Revisa el nombre de la campaña.',400);
 return {...(v.name_mode?{name_mode:v.name_mode}:{}),mode:v.mode,parent_id:v.parent_id,start_at:v.start_at,category:'NONE',meta,assignments};
}
export function buildMetaRecipe(experiment:Item,code:string,selection:MetaSelection,attachments:Attachment[],variants:Variant[],connection:{accountId:string;pageId?:string;instagramId?:string;pixelId?:string;revision:string;currency?:string},now=Date.now()):MetaRecipe{
 const stored=executionFromFields(experiment.fields),options=selection.meta;
 const plan=stored?{...stored,currency:stored.currency||connection.currency||null,variants:stored.variants.map(v=>({...v}))}:null;
 if(plan&&plan.variants.length&&plan.variants.every(v=>v.allocation===null))plan.variants=plan.variants.map(v=>({...v,allocation:100/plan.variants.length}));
 if(selection.name_mode==='exact'&&experiment.title.length>200)throw new ApiError('Acorta el nombre del experimento a 200 caracteres para conservarlo igual en Meta.',400);
 if(experiment.kind!=='experiment'||experiment.fields.channel!=='meta_ads'||!plan||!plan.destination||!plan.variants.length||!/^EXP-[A-Z0-9-]{1,100}$/.test(code))throw new ApiError('Guarda una ficha de Meta con destino, código y variantes.',400);
 if(!options.objective||!options.placements.length||options.age_min===null||options.age_max===null||(!options.countries.length&&!options.city_key))throw new ApiError('Confirma objetivo, ubicaciones, edades y países o ciudad.',400);
 if(!/^\d{1,30}$/.test(connection.pageId||'')||!/^\d{1,30}$/.test(connection.instagramId||''))throw new ApiError('Configura la página y la cuenta de Instagram en Integraciones.',400);
 const conversion=['leads','sales'].includes(options.objective);
 if(conversion&&(!/^\d{1,30}$/.test(connection.pixelId||'')||!options.conversion_event))throw new ApiError('Configura un píxel y selecciona el evento real para leads o ventas.',400);
 if(!['USD','EUR','GBP'].includes(plan.currency||''))throw new ApiError('Esta preparación admite USD, EUR o GBP; otras monedas necesitan validar sus unidades mínimas.',400);
 const createsBudget=selection.mode!=='ad';
 if(createsBudget&&(!plan.daily_budget||!selection.start_at||Date.parse(selection.start_at)<now+300000))throw new ApiError('Indica el presupuesto diario en el prompt; el inicio propuesto debe estar al menos cinco minutos en el futuro.',400);
 const total=Math.round((plan.daily_budget||0)*(plan.duration_days||1)*100);
 if(createsBudget&&(!Number.isSafeInteger(total)||total<100||total>100000000))throw new ApiError('Revisa el presupuesto total del periodo.',400);
 const allocations=plan.variants.map(v=>v.allocation);
 if(createsBudget&&(allocations.some(v=>v===null||v<=0)||Math.abs(allocations.reduce<number>((s,v)=>s+(v||0),0)-100)>0.01))throw new ApiError('Confirma un reparto positivo que sume 100% entre variantes.',400);
 if(selection.mode==='ad'&&(plan.variants.length!==1||options.placements.length!==1))throw new ApiError('Para añadir un anuncio a un conjunto existente, selecciona una variante y una ubicación.',400);
 if(selection.assignments.length!==plan.variants.length*options.placements.length)throw new ApiError('Asigna una creatividad por variante y ubicación.',400);
 const steps:MetaStep[]=selection.mode==='campaign'?[{key:'campaign',kind:'campaign',label:'Campaña pausada',variant_id:null}]:[];
 let assignedBudget=0;
 for(const [i,v] of plan.variants.entries()){
  const saved=variants.find(row=>row.label===v.label);if(!saved)throw new ApiError('Guarda las variantes de la ficha antes de preparar Meta.',400);
  const ctas:Record<string,string>={'saber más':'LEARN_MORE','más información':'LEARN_MORE','aprender más':'LEARN_MORE','visitar sitio':'LEARN_MORE','registrarse':'SIGN_UP','regístrate':'SIGN_UP','comprar':'SHOP_NOW','contactar':'CONTACT_US','descargar':'DOWNLOAD'};
  const cta=ctas[(v.call_to_action||'').toLowerCase()]||v.call_to_action;
  if(!v.headline||!v.body||!['LEARN_MORE','SIGN_UP','SHOP_NOW','CONTACT_US','DOWNLOAD','GET_QUOTE','SUBSCRIBE'].includes(cta||''))throw new ApiError(`Completa titular, texto y CTA de ${v.label}. Usa una llamada compatible, por ejemplo SIGN_UP o LEARN_MORE.`,400);
  for(const [p,placement] of options.placements.entries()){
   const key=`v${i}_${placement}`,matches=selection.assignments.filter(a=>a.variant===v.label&&a.placement===placement);
   if(matches.length!==1)throw new ApiError('Revisa las asignaciones duplicadas o pendientes.',400);
   const a=matches[0],attachment=attachments.find(row=>row.id===a.attachment_id&&row.record_id===experiment.id&&row.workspace_id===experiment.workspace_id);
   if(!attachment||!['image','video'].includes(attachment.kind)||!attachment.storage_path)throw new ApiError('Selecciona un adjunto privado de este experimento.',400);
   const common={variant_id:saved.id,placement};
   const budget=i===plan.variants.length-1&&p===options.placements.length-1?total-assignedBudget:Math.floor(total*(v.allocation||0)/100/options.placements.length);assignedBudget+=budget;
   if(createsBudget&&budget<100)throw new ApiError('El presupuesto por variante y ubicación debe ser al menos una unidad monetaria; Meta puede exigir un mínimo mayor.',400);
   steps.push({...common,key:`${key}_media`,kind:attachment.kind as 'image'|'video',label:`${v.label} · ${placement} · material`,attachment,crop:a.crop});
   if(attachment.kind==='video'){
    if(attachment.mime_type!=='video/mp4')throw new ApiError('Para Meta utiliza vídeo MP4. El análisis de IA también admite WebM.',400);
    const thumbnail=attachments.find(row=>row.id===a.thumbnail_id&&row.kind==='image'&&row.record_id===experiment.id&&row.workspace_id===experiment.workspace_id);
    if(!thumbnail?.storage_path)throw new ApiError('Cada vídeo necesita una imagen de portada adjunta a este experimento.',400);
    steps.push({...common,key:`${key}_thumbnail`,kind:'thumbnail',label:`${v.label} · ${placement} · portada`,attachment:thumbnail,crop:a.crop});
   }
   if(createsBudget)steps.push({...common,key:`${key}_adset`,kind:'adset',label:`${v.label} · ${placement} · conjunto pausado`,budget});
   const variant={label:v.label,headline:v.headline,body:v.body,cta:cta!};
   steps.push({...common,key:`${key}_creative`,kind:'creative',label:`${v.label} · ${placement} · creatividad`,variant});
   steps.push({...common,key:`${key}_ad`,kind:'ad',label:`${v.label} · ${placement} · anuncio pausado`,variant});
  }
 }
 const mapping={traffic:['OUTCOME_TRAFFIC','LINK_CLICKS'],awareness:['OUTCOME_AWARENESS','REACH'],leads:['OUTCOME_LEADS','OFFSITE_CONVERSIONS'],sales:['OUTCOME_SALES','OFFSITE_CONVERSIONS'],engagement:['OUTCOME_ENGAGEMENT','POST_ENGAGEMENT']} as const;
 return {selection,name:selection.name_mode==='exact'?experiment.title:`${code} · ${experiment.title}`.slice(0,160),objective:mapping[options.objective][0],optimization:mapping[options.objective][1],destination:plan.destination,currency:plan.currency!,total:createsBudget?total:0,...(createsBudget&&!plan.duration_days?{budget_period:'daily' as const}:{}),start:createsBudget?selection.start_at:null,end:createsBudget&&plan.duration_days?new Date(Date.parse(selection.start_at!)+plan.duration_days!*86400000).toISOString():null,page:connection.pageId!,instagram:connection.instagramId!,pixel:conversion?connection.pixelId!:null,steps,revision:experiment.updated_at,connection_revision:connection.revision,account_id:connection.accountId};
}
export function metaStepPayload(recipe:MetaRecipe,step:MetaStep,results:Record<string,MetaStepResult>){
 const campaign=recipe.selection.mode==='campaign'?results.campaign?.id:recipe.selection.parent_id;
 const prefix=step.key.replace(/_(adset|creative|ad)$/,'');
 const options=recipe.selection.meta;
 const targeting={geo_locations:options.city_key?{cities:[{key:options.city_key}]}:{countries:options.countries},age_min:options.age_min,age_max:options.age_max,publisher_platforms:['facebook','instagram'],facebook_positions:[step.placement==='feed'?'feed':step.placement==='story'?'story':'facebook_reels'],instagram_positions:[step.placement==='feed'?'stream':step.placement==='story'?'story':'reels']};
 if(step.kind==='campaign')return {name:recipe.name,objective:recipe.objective,status:'PAUSED',special_ad_categories:[],is_adset_budget_sharing_enabled:false};
 if(step.kind==='adset')return {name:`${recipe.name} · ${step.label}`.slice(0,200),campaign_id:campaign,...(recipe.budget_period==='daily'?{daily_budget:step.budget}:{lifetime_budget:step.budget}),billing_event:'IMPRESSIONS',optimization_goal:recipe.optimization,bid_strategy:'LOWEST_COST_WITHOUT_CAP',destination_type:recipe.optimization==='POST_ENGAGEMENT'?'ON_AD':'WEBSITE',start_time:recipe.start,...(recipe.end?{end_time:recipe.end}:{}),targeting,status:'PAUSED',...(recipe.pixel?{promoted_object:{pixel_id:recipe.pixel,custom_event_type:options.conversion_event}}:{})};
 if(step.kind==='creative'){
  const media=recipe.steps.find(s=>s.key===`${prefix}_media`)!;
  const cta={type:step.variant!.cta,value:{link:recipe.destination}};
  const story={page_id:recipe.page,instagram_user_id:recipe.instagram,...(media.kind==='video'?{video_data:{video_id:results[media.key]?.id,image_hash:results[`${prefix}_thumbnail`]?.hash,message:step.variant!.body,title:step.variant!.headline,call_to_action:cta}}:{link_data:{image_hash:results[media.key]?.hash,link:recipe.destination,message:step.variant!.body,name:step.variant!.headline,call_to_action:cta}})};
  return {name:`${recipe.name} · ${step.label}`.slice(0,200),object_story_spec:story};
 }
 if(step.kind==='ad')return {name:`${recipe.name} · ${step.label}`.slice(0,200),adset_id:recipe.selection.mode==='ad'?recipe.selection.parent_id:results[`${prefix}_adset`]?.id,creative:{creative_id:results[`${prefix}_creative`]?.id},status:'PAUSED'};
 throw new ApiError('Este paso necesita preparar su archivo.',400);
}
export function nextMetaStep(recipe:MetaRecipe,rows:{step_key:string;status:string;result:MetaStepResult}[]){
 const results=Object.fromEntries(rows.filter(r=>r.status==='succeeded').map(r=>[r.step_key,r.result]));
 const step=recipe.steps.find(s=>!results[s.key]);
 const receipt=rows.find(r=>r.step_key===step?.key);
 return {step,results,blocked:!!receipt&&['pending','uncertain'].includes(receipt.status)};
}

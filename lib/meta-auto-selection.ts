import type {ExecutionPlan} from './execution-plan';
import type {Attachment} from './attachments';
import {emptyMeta} from './meta-options';
import type {MetaSelection} from './meta-build';
// Proposals only. Crops, defaults, audience and budget are reviewed before any write.
export function automaticMetaSelection(plan:ExecutionPlan|null,attachments:Attachment[],start:string|undefined,now=Date.now()):MetaSelection{
 const meta={...(plan?.meta||emptyMeta())};
 meta.age_min??=18;meta.age_max??=65;
 if(!meta.placements.length)meta.placements=['feed','story','reels'];
 const media=attachments.filter(a=>['image','video'].includes(a.kind)).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 const used=new Set<string>();
 const normalize=(value:string)=>value.split(/[\\/]/).pop()!.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9]/g,'');
 // Resolve against actual private attachments. Model-generated, stale or ambiguous
 // names are hints, never a reason to discard an otherwise usable draft.
 const namedFiles=(names:string[])=>{
  const exact=media.filter(a=>names.some(n=>n.trim().toLowerCase()===a.name.trim().toLowerCase()));
  if(exact.length)return exact;
  const normalized=media.filter(a=>names.some(n=>normalize(n)===normalize(a.name)));if(normalized.length)return normalized;
  return media.filter(a=>names.some(n=>normalize(n).length>=3&&(normalize(a.name).startsWith(normalize(n))||normalize(n).startsWith(normalize(a.name)))));
 };
 const reserved=new Set((plan?.variants||[]).flatMap(v=>{const matches=namedFiles(v.media_names||[]);return matches.length===1?[matches[0].id]:[];}));
 const assignments:MetaSelection['assignments']=[];
 for(const [i,v] of (plan?.variants||[]).entries()){
  const named=namedFiles(v.media_names||[]);
  const hints=normalize(`${v.label} ${v.description||''}`);
  const hinted=media.find(a=>!used.has(a.id)&&normalize(a.name).length>=3&&hints.includes(normalize(a.name)));
  const a=named.find(a=>!used.has(a.id))||named[0]||hinted||media.find(a=>!used.has(a.id)&&!reserved.has(a.id))||media.find(a=>!used.has(a.id))||media[i%media.length];
  if(!a)throw new Error('No hay ninguna imagen o vídeo utilizable en esta ficha. Adjunta una creatividad para preparar los anuncios.');
  used.add(a.id);
  const thumbnail=a.kind==='video'?media.find(m=>m.kind==='image'):null;
  if(a.kind==='video'&&!thumbnail)throw new Error(`Adjunta una imagen de portada para el vídeo de ${v.label}.`);
  for(const placement of meta.placements)assignments.push({variant:v.label,placement,attachment_id:a.id,thumbnail_id:thumbnail?.id||null,crop:'centre'});
 }
 const date=start&&/^\d{4}-\d{2}-\d{2}$/.test(start)?Date.parse(`${start}T12:00:00.000Z`):NaN;
 const start_at=new Date(Number.isFinite(date)&&date>now+900000?date:now+900000).toISOString();
 return {name_mode:'experiment',mode:'campaign',parent_id:null,start_at,meta,category:'NONE',assignments};
}

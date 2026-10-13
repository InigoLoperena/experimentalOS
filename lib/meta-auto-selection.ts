import type {ExecutionPlan} from './execution-plan';
import type {Attachment} from './attachments';
import {emptyMeta} from './meta-options';
import type {MetaSelection} from './meta-build';
// Proposals only. Crops, defaults, audience and budget are reviewed before any write.
export function automaticMetaSelection(plan:ExecutionPlan|null,attachments:Attachment[],start:string|undefined,now=Date.now()):MetaSelection{
 const meta={...(plan?.meta||emptyMeta())};
 meta.age_min??=18;meta.age_max??=65;
 if(!meta.placements.length)meta.placements=['feed','story','reels'];
 const media=attachments.filter(a=>['image','video'].includes(a.kind)).sort((a,b)=>a.name.localeCompare(b.name));
 const assignments:MetaSelection['assignments']=[];
 for(const [i,v] of (plan?.variants||[]).entries()){
  const named=media.filter(a=>v.media_names?.some(n=>n.trim().toLowerCase()===a.name.trim().toLowerCase()));
  if(v.media_names?.length&&named.length!==1)throw new Error(`Aclara en el prompt qué archivo usar en ${v.label}: no hay una asignación única a sus adjuntos.`);
  const a=named[0]||(media.length===1?media[0]:media.length===plan?.variants.length?media[i]:null);
  if(!a)throw new Error(`Adjunta o indica en el prompt el material de ${v.label}.`);
  const thumbnail=a.kind==='video'?media.find(m=>m.kind==='image'):null;
  if(a.kind==='video'&&!thumbnail)throw new Error(`Adjunta una imagen de portada para el vídeo de ${v.label}.`);
  for(const placement of meta.placements)assignments.push({variant:v.label,placement,attachment_id:a.id,thumbnail_id:thumbnail?.id||null,crop:'centre'});
 }
 const date=start&&/^\d{4}-\d{2}-\d{2}$/.test(start)?Date.parse(`${start}T12:00:00.000Z`):NaN;
 const start_at=new Date(Number.isFinite(date)&&date>now+900000?date:now+900000).toISOString();
 return {name_mode:'exact',mode:'campaign',parent_id:null,start_at,meta,category:'NONE',assignments};
}

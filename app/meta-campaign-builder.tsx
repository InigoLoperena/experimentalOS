'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Item} from '@/lib/model';
import type {Attachment} from '@/lib/attachments';
import {executionFromFields} from '@/lib/execution-plan';
import {emptyMeta,metaObjectives,metaPlacements,metaFormats,metaEvents,type MetaOptions} from '@/lib/meta-options';
import type {MetaSelection} from '@/lib/meta-build';
type Preview={key:string;label:string;preview:string;width:number;height:number;upscaled:boolean};
type Review={fingerprint:string;account:{name:string;id:string};name:string;objective:string;optimization:string;currency:string;total:number;start:string|null;end:string|null;previews:Preview[];write_available:boolean;selection:MetaSelection;steps:{key:string;kind:string;label:string;budget?:number}[]};
type Run={id:string;selection:MetaSelection;created_at:string};
export function MetaCampaignBuilder({experiment,locked,onBusy,onCreated}:{experiment:Item;locked:boolean;onBusy:(busy:boolean)=>void;onCreated:()=>Promise<void>}){
 let plan:ReturnType<typeof executionFromFields>=null;
 let planError='';
 try{plan=executionFromFields(experiment.fields);}catch{planError='La configuración guardada no es válida. Revisa y guarda la ficha antes de preparar Meta.';}
 const [selection,setSelection]=useState<MetaSelection>({mode:'campaign',parent_id:null,start_at:null,meta:plan?.meta||emptyMeta(),category:'NONE',assignments:[]});
 const [category,setCategory]=useState(false),[audienceConfirmed,setAudienceConfirmed]=useState(false),[confirmed,setConfirmed]=useState(false);
 const [attachments,setAttachments]=useState<Attachment[]>([]),[runs,setRuns]=useState<Run[]>([]),[runId,setRunId]=useState<string|null>(null);
 const [review,setReview]=useState<Review|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [localStart,setLocalStart]=useState(''),[loaded,setLoaded]=useState(false);
 const [singlePreview,setSinglePreview]=useState<Preview|null>(null);
 const [cityQuery,setCityQuery]=useState(''),[cities,setCities]=useState<{key:string;name:string;region:string;country:string}[]>([]);
 const [identity,setIdentity]=useState<{page:{id:string;name:string};instagram:{id:string;username:string}|null;pixels:{id:string;name:string}[]}|null>(null);
 const flight=useRef(false),active=useRef(true),stop=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;stop.current=true;};},[]);
 async function api(action:string,extra:Record<string,unknown>={}){
  const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error('Inicia sesión para continuar.');
  const response=await fetch('/api/meta/build',{method:'POST',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action,project_id:experiment.project_id,experiment_id:experiment.id,...extra})});
  const value=await response.json();if(!response.ok)throw new Error(value.error||'No se pudo completar la preparación.');return value;
 }
 async function task(fn:()=>Promise<void>){
  if(flight.current||locked)return;flight.current=true;setBusy(true);onBusy(true);setError('');
  try{await fn();}catch(err){if(active.current)setError(err instanceof Error?err.message:'No se pudo completar la preparación.');}
  finally{flight.current=false;onBusy(false);if(active.current)setBusy(false);}
 }
 function update(next:MetaSelection){setSelection(next);setReview(null);setSinglePreview(null);setConfirmed(false);setRunId(null);}
 function meta(next:MetaOptions){update({...selection,meta:next,assignments:selection.assignments.filter(a=>next.placements.includes(a.placement))});setAudienceConfirmed(false);}
 function assign(variant:string,placement:keyof typeof metaFormats,values:Partial<MetaSelection['assignments'][number]>){
  const previous=selection.assignments.find(a=>a.variant===variant&&a.placement===placement);
  update({...selection,assignments:[...selection.assignments.filter(a=>!(a.variant===variant&&a.placement===placement)),{variant,placement,attachment_id:'',thumbnail_id:null,crop:'centre',...previous,...values}]});
 }
 async function load(){const value=await api('context');if(active.current){setAttachments(value.attachments);setRuns(value.runs);setLoaded(true);
  if(!loaded&&!selection.assignments.length){const proposed:MetaSelection['assignments']=[];for(const v of plan?.variants||[])for(const placement of selection.meta.placements){const matches=(value.attachments as Attachment[]).filter(a=>v.media_names?.includes(a.name)&&['image','video'].includes(a.kind));if(matches.length===1)proposed.push({variant:v.label,placement,attachment_id:matches[0].id,thumbnail_id:null,crop:'centre'});}setSelection(previous=>({...previous,assignments:proposed}));}
 }}
 async function metaQuery(action:string,extra:Record<string,unknown>={}){
  const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error('Inicia sesión para continuar.');
  const result=await fetch('/api/meta',{method:'POST',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({project_id:experiment.project_id,action,...extra})});
  const value=await result.json();if(!result.ok)throw new Error(value.error||'Meta no respondió.');return value;
 }
 async function execute(id:string){
  stop.current=false;
  // Each request performs one write and persists its receipt. No automatic retry.
  for(let i=0;i<80&&!stop.current;i++){
   const result=await api('step',{run_id:id});
   if(!active.current)return;
   if(result.done){setMessage('Preparación completada. Los recursos están pausados; revisa y publica manualmente en Ads Manager.');await onCreated();await load();return;}
   if(result.waiting){setMessage(result.message);await onCreated();return;}
   setMessage(`${result.step} · confirmado ${result.result.id||result.result.hash}`);
   await onCreated();
  }
  if(active.current)setMessage('Preparación detenida entre pasos. Puedes continuar desde los IDs ya guardados.');
 }
 if(experiment.fields.channel!=='meta_ads')return null;
 if(planError)return <p className="error" role="alert">{planError}</p>;
 return <details className="monitoring-block" onToggle={e=>{if(e.currentTarget.open&&!loaded&&!flight.current)void task(load);}}><summary>Preparar campaña, conjunto o anuncio con creatividades</summary>
  <p className="small">Usa la configuración guardada de la ficha. La IA la propone desde «Editar ficha → Preparar con IA»; aquí revisas los parámetros reales antes de enviarlos a Meta. Los originales siguen siendo adjuntos privados.</p>
  <fieldset disabled={busy||locked} className="monitoring-grid">
   <label>Qué preparar<select value={selection.mode} onChange={e=>update({...selection,mode:e.target.value as MetaSelection['mode'],parent_id:e.target.value==='campaign'?null:''})}><option value="campaign">Nueva campaña con conjuntos y anuncios</option><option value="adset">Conjuntos y anuncios en una campaña pausada existente</option><option value="ad">Un anuncio en un conjunto pausado existente</option></select></label>
   {selection.mode!=='campaign'&&<label>ID de {selection.mode==='ad'?'conjunto':'campaña'} de Meta<input inputMode="numeric" value={selection.parent_id||''} onChange={e=>update({...selection,parent_id:e.target.value})}/></label>}
   <label>Objetivo técnico<select value={selection.meta.objective||''} onChange={e=>meta({...selection.meta,objective:e.target.value as MetaOptions['objective']||null})}><option value="">Confirma el objetivo…</option>{Object.entries(metaObjectives).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label>Países · códigos ISO<input placeholder="US, ES…" value={selection.meta.countries.join(',')} onChange={e=>meta({...selection.meta,countries:e.target.value.toUpperCase().split(',').map(s=>s.trim()).filter(Boolean),city_key:null})}/></label>
   <div><label>Buscar ciudad en Meta<input value={cityQuery} maxLength={100} onChange={e=>{setCityQuery(e.target.value);setCities([]);}}/></label><button type="button" className="btn" disabled={cityQuery.trim().length<2} onClick={()=>void task(async()=>{const value=await metaQuery('cities',{query:cityQuery});setCities(value.cities);})}>Buscar ciudad</button><label>Ciudad · alternativa a países<select value={selection.meta.city_key||''} onChange={e=>meta({...selection.meta,city_key:e.target.value||null,countries:e.target.value?[]:selection.meta.countries})}><option value="">Usar países</option>{selection.meta.city_key&&!cities.some(c=>c.key===selection.meta.city_key)&&<option value={selection.meta.city_key}>Ciudad seleccionada · {selection.meta.city_key}</option>}{cities.map(c=><option key={c.key} value={c.key}>{c.name} · {c.region} · {c.country}</option>)}</select></label></div>
   <label>Edad mínima<input type="number" min={18} max={65} value={selection.meta.age_min??''} onChange={e=>meta({...selection.meta,age_min:e.target.value?Number(e.target.value):null})}/></label>
   <label>Edad máxima · 65 incluye mayores<input type="number" min={18} max={65} value={selection.meta.age_max??''} onChange={e=>meta({...selection.meta,age_max:e.target.value?Number(e.target.value):null})}/></label>
   {['leads','sales'].includes(selection.meta.objective||'')&&<label>Evento del píxel<select value={selection.meta.conversion_event||''} onChange={e=>meta({...selection.meta,conversion_event:e.target.value as MetaOptions['conversion_event']||null})}><option value="">Selecciona el evento real</option>{metaEvents.map(event=><option key={event}>{event}</option>)}</select></label>}
   {selection.mode!=='ad'&&<label>Inicio · hora de este navegador<input type="datetime-local" value={localStart} onChange={e=>{setLocalStart(e.target.value);update({...selection,start_at:e.target.value?new Date(e.target.value).toISOString():null});}}/></label>}
   <div>{Object.entries(metaPlacements).map(([k,label])=><label className="check" key={k}><input type="checkbox" checked={selection.meta.placements.includes(k as keyof typeof metaPlacements)} onChange={e=>meta({...selection.meta,placements:e.target.checked?[...selection.meta.placements,k as keyof typeof metaPlacements]:selection.meta.placements.filter(p=>p!==k)})}/>{label}</label>)}</div>
  </fieldset>
  <button type="button" className="btn" disabled={busy||locked} onClick={()=>void task(async()=>{setIdentity(await metaQuery('identity'));})}>Consultar página, Instagram y píxeles de la cuenta</button>
  {identity&&<div className="notice"><p>Página: {identity.page.name} · {identity.page.id}<br/>Instagram: {identity.instagram?`${identity.instagram.username} · ${identity.instagram.id}`:'No devuelto por Meta; revisa vínculo y permisos de página.'}</p>{identity.pixels.map(p=><p key={p.id}>Píxel: {p.name} · {p.id}</p>)}<p className="small">El superadministrador puede guardar estos IDs en Integraciones. Que un píxel sea accesible no confirma que su evento esté midiendo correctamente.</p></div>}
  <p className="small">Público amplio por zona y edad. Los intereses de la ficha son una descripción y no se envían como segmentación. Se crea un conjunto por variante y ubicación, con presupuesto total del periodo dividido según el reparto de variantes y a partes iguales entre ubicaciones. Meta decide el ritmo de gasto; el importe diario es una referencia. Esta comparación no constituye una prueba A/B aleatoria.</p>
  {plan?.variants.map(v=><fieldset key={v.label} disabled={busy||locked} className="monitoring-block"><legend>{v.label} · {v.allocation??'pendiente'}%</legend>
   <p><strong>{v.headline||'Titular pendiente'}</strong><br/>{v.body||'Texto pendiente'}<br/>CTA: {v.call_to_action||'Pendiente'}</p>
   {selection.meta.placements.map(placement=>{const assigned=selection.assignments.find(a=>a.variant===v.label&&a.placement===placement),attachment=attachments.find(a=>a.id===assigned?.attachment_id);return <div key={placement} className="monitoring-grid"><label>{metaPlacements[placement]} · material<select value={assigned?.attachment_id||''} onChange={e=>assign(v.label,placement,{attachment_id:e.target.value})}><option value="">Seleccionar adjunto…</option>{attachments.filter(a=>a.kind==='image'||a.kind==='video').map(a=><option key={a.id} value={a.id}>{a.name} · {a.kind==='video'?'Vídeo':'Imagen'}</option>)}</select></label>
    {attachment?.kind==='video'&&<label>Portada del vídeo<select value={assigned?.thumbnail_id||''} onChange={e=>assign(v.label,placement,{thumbnail_id:e.target.value||null})}><option value="">Seleccionar imagen adjunta…</option>{attachments.filter(a=>a.kind==='image').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
    <label>Recorte de imagen / portada<select value={assigned?.crop||'centre'} onChange={e=>assign(v.label,placement,{crop:e.target.value as MetaSelection['assignments'][number]['crop']})}><option value="centre">Centrado</option><option value="attention">Automático por contenido</option><option value="north">Priorizar parte superior</option><option value="south">Priorizar parte inferior</option></select></label>
    <button type="button" className="btn" disabled={!assigned||(attachment?.kind==='video'?!assigned.thumbnail_id:!attachment)} onClick={()=>void task(async()=>{const value=await api('preview',{attachment_id:attachment?.kind==='video'?assigned?.thumbnail_id:assigned?.attachment_id,placement,crop:assigned?.crop||'centre'});setSinglePreview({...value,key:'preview',label:`${v.label} · ${placement}`});})}>Ver recorte</button>
   </div>;})}
  </fieldset>)}
  {singlePreview&&<figure><img src={singlePreview.preview} alt={`Recorte de ${singlePreview.label}`} width={280}/><figcaption>{singlePreview.label} · {singlePreview.width} × {singlePreview.height}{singlePreview.upscaled&&' · ampliada: revisa nitidez'}</figcaption></figure>}
  <p className="small">Añade imágenes o vídeos en «Editar ficha → Preparar con IA» o en los adjuntos, y guarda antes de seleccionarlos aquí. Imágenes: copia JPG recortada a 1440 × 1800 para Feed y 1440 × 2560 para Stories/Reels. El recorte se muestra para aprobación; ampliar una imagen pequeña no recupera detalle. Vídeos: MP4 hasta 10 MB, formato final preparado por ti (4:5 para Feed y 9:16 para Stories/Reels); se conserva el archivo, sin recortar vídeo ni modificar su audio. Usa una portada privada para cada vídeo.</p>
  <label className="check"><input type="checkbox" disabled={busy||locked} checked={category} onChange={e=>{setCategory(e.target.checked);setReview(null);setConfirmed(false);}}/>Confirmo que no pertenece a categorías especiales de Meta.</label>
  <label className="check"><input type="checkbox" disabled={busy||locked} checked={audienceConfirmed} onChange={e=>{setAudienceConfirmed(e.target.checked);setReview(null);setConfirmed(false);}}/>Apruebo el público amplio de zona y edad, el reparto por ubicaciones y el evento elegido. Revisaré su medición antes de publicar.</label>
  <button type="button" className="btn" disabled={busy||locked||!category||!audienceConfirmed} onClick={()=>void task(async()=>{const value=await api('review',{selection});if(active.current){setReview(value);setConfirmed(false);}})}>Revisar configuración y recortes</button>
  {review&&<section className="assistant-proposal"><h4>{review.name}</h4><p>Cuenta: {review.account.name} ({review.account.id})<br/>Objetivo: {review.objective} · Optimización: {review.optimization}<br/>Presupuesto total nuevo: {review.total.toFixed(2)} {review.currency}<br/>Inicio: {review.start?new Date(review.start).toLocaleString():'El del conjunto existente'} · Fin: {review.end?new Date(review.end).toLocaleString():'El del conjunto existente'}</p>
   <ol>{review.steps.map(s=><li key={s.key}>{s.label}{s.budget!==undefined?` · ${(s.budget/100).toFixed(2)} ${review.currency} para todo el periodo`:''}</li>)}</ol>
   <div className="meta-previews">{review.previews.map(p=><figure key={p.key}><img src={p.preview} alt={`Recorte a revisar: ${p.label}`} width={280}/><figcaption>{p.label}<br/>{p.width} × {p.height}{p.upscaled&&' · imagen ampliada: revisa nitidez'}</figcaption></figure>)}</div>
   <label className="check"><input type="checkbox" disabled={busy||locked} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Apruebo todos los recortes y esta configuración. Autorizo enviar estos materiales y crear los recursos pausados en esta cuenta.</label>
   {!review.write_available&&<p className="notice">Falta configurar el token de preparación en Integraciones.</p>}
   <button type="button" className="btn primary" disabled={busy||locked||!confirmed||!review.write_available} onClick={()=>void task(async()=>{const result=await api('begin',{selection:review.selection,fingerprint:review.fingerprint,confirmed,request_id:crypto.randomUUID()});setRunId(result.run_id);await execute(result.run_id);})}>Crear preparación pausada en Meta</button>
  </section>}
  {!!runs.length&&<div className="monitoring-block"><h4>Preparaciones guardadas</h4>{runs.map(r=><p key={r.id}>{new Date(r.created_at).toLocaleString()} · {r.selection.mode}<button type="button" className="btn" disabled={busy||locked} onClick={()=>void task(async()=>{setSelection(r.selection);setRunId(r.id);await execute(r.id);})}>Continuar preparación aprobada</button></p>)}</div>}
  {busy&&runId&&<button type="button" className="btn" onClick={()=>{stop.current=true;}}>Detener al terminar este paso</button>}
  {message&&<p className="notice" role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}
 </details>;
}

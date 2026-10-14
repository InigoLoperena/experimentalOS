'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Item} from '@/lib/model';
import {executionFromFields} from '@/lib/execution-plan';
import {emptyMeta} from '@/lib/meta-options';
import {automaticMetaSelection} from '@/lib/meta-auto-selection';
import type {MetaSelection} from '@/lib/meta-build';
type Preview={key:string;label:string;preview:string;width:number;height:number;upscaled:boolean};
type Review={fingerprint:string;account:{name:string;id:string};name:string;objective:string;optimization:string;currency:string;total:number;budget_period?:'daily'|'total';start:string|null;end:string|null;previews:Preview[];write_available:boolean;selection:MetaSelection;notes?:string[];steps:{key:string;kind:string;label:string;budget?:number;attachment_name?:string}[]};
type Run={id:string;selection:MetaSelection;created_at:string};
export function MetaCampaignBuilder({experiment,locked,onBusy,onCreated,openOnArrival=false}:{experiment:Item;locked:boolean;onBusy:(busy:boolean)=>void;onCreated:()=>Promise<void>;openOnArrival?:boolean}){
 let plan:ReturnType<typeof executionFromFields>=null;
 let planError='';
 try{plan=executionFromFields(experiment.fields);}catch{planError='La configuración guardada no es válida. Revisa y guarda la ficha antes de preparar Meta.';}
 const [selection,setSelection]=useState<MetaSelection>({mode:'campaign',parent_id:null,start_at:null,meta:plan?.meta||emptyMeta(),category:'NONE',assignments:[]});
 const [confirmed,setConfirmed]=useState(false);
 const [runs,setRuns]=useState<Run[]>([]),[runId,setRunId]=useState<string|null>(null);
 const [review,setReview]=useState<Review|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [loaded,setLoaded]=useState(false);
 const [campaigns,setCampaigns]=useState<{external_id:string;label:string}[]>([]),[destinationChosen,setDestinationChosen]=useState(false);


 const flight=useRef(false),active=useRef(true),stop=useRef(false);
 const panel=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{if(openOnArrival&&panel.current){panel.current.open=true;panel.current.scrollIntoView({block:'start'});panel.current.querySelector('summary')?.focus();}},[openOnArrival]);
 useEffect(()=>{active.current=true;return()=>{active.current=false;stop.current=true;};},[]);
 async function api(action:string,extra:Record<string,unknown>={}){
  const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error('Inicia sesión para continuar.');
  const response=await fetch('/api/meta/build',{method:'POST',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action,project_id:experiment.project_id,experiment_id:experiment.id,...extra})});
  const value=await response.json();if(!response.ok)throw new Error(value.error||'No se pudo completar la preparación.');return value;
 }
 async function task(fn:()=>Promise<unknown>){
  if(flight.current||locked)return;flight.current=true;setBusy(true);onBusy(true);setError('');
  try{await fn();}catch(err){if(active.current)setError(err instanceof Error?err.message:'No se pudo completar la preparación.');}
  finally{flight.current=false;onBusy(false);if(active.current)setBusy(false);}
 }
 async function load(){
  const value=await api('context');if(!active.current)return;
  setRuns(value.runs);setCampaigns(value.campaigns||[]);setDestinationChosen(!value.campaigns?.length);
  const next=automaticMetaSelection(plan,value.attachments,typeof experiment.fields.start==='string'?experiment.fields.start:undefined);setSelection(next);setLoaded(true);return next;
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
 return <details ref={panel} className="monitoring-block" onToggle={e=>{if(e.currentTarget.open&&!loaded&&!flight.current)void task(load);}}><summary>Enviar a Meta</summary>
  <p className="small">Usaremos el prompt y los archivos de la ficha. Revisa las imágenes y confirma el envío; la campaña y los anuncios quedarán pausados.</p>
  {!!campaigns.length&&<section className="notice"><p>Ya hay campañas vinculadas. Elige completar una para evitar duplicados:</p>{campaigns.map(c=><button key={c.external_id} type="button" className="btn" disabled={busy||locked} onClick={()=>{setSelection(previous=>({...previous,mode:'adset',parent_id:c.external_id}));setDestinationChosen(true);setReview(null);setConfirmed(false);}}>Completar campaña {c.external_id}</button>)}<button type="button" className="btn" disabled={busy||locked} onClick={()=>{setSelection(previous=>({...previous,mode:'campaign',parent_id:null}));setDestinationChosen(true);setReview(null);setConfirmed(false);}}>Crear otra campaña nueva</button>{destinationChosen&&<p>{selection.mode==='adset'?`Se prepararán anuncios en la campaña ${selection.parent_id}.`:'Se creará otra campaña, conservando las anteriores.'}</p>}</section>}
  <button type="button" className="btn" disabled={busy||locked||(loaded&&!destinationChosen)} onClick={()=>void task(async()=>{let proposed=loaded?selection:await load();if(!proposed)throw new Error('No se pudo preparar el borrador.');if(proposed.start_at&&Date.parse(proposed.start_at)<Date.now()+300000)proposed={...proposed,start_at:new Date(Date.now()+900000).toISOString()};setSelection(proposed);const value=await api('review',{selection:proposed});if(active.current){setReview(value);setConfirmed(false);}})}>Revisar imágenes y envío</button>
  {review&&<section className="assistant-proposal"><h4>{review.name}</h4><p>Cuenta: {review.account.name}<br/>Objetivo: {review.objective}<br/>Presupuesto {review.budget_period==='daily'?'diario':'total'}: {review.total.toFixed(2)} {review.currency}<br/>Inicio: {review.start?new Date(review.start).toLocaleString():'Conjunto existente'} · Fin: {review.end?new Date(review.end).toLocaleString():'Conjunto existente'}</p>
   <p className="small">{review.steps.filter(s=>s.kind==='ad').length} anuncios. Público: {review.selection.meta.countries.join(', ')} · {review.selection.meta.age_min}–{review.selection.meta.age_max} años. Los intereses escritos en el prompt no se aplican en este flujo; se usa esa zona y edad.</p>
   {plan?.variants.map(v=><p key={v.label}><strong>{v.label}: {v.headline}</strong><br/>{v.body}</p>)}
   {review.notes?.map(note=><p key={note} className="small">{note}</p>)}
   <p className="small">Archivos elegidos automáticamente: {[...new Set(review.steps.filter(s=>s.attachment_name).map(s=>`${s.label}: ${s.attachment_name}`))].join(' · ')}. Se pueden revisar en Meta después de crear el borrador.</p>
   <div className="meta-previews">{review.previews.map(p=><figure key={p.key}><img src={p.preview} alt={p.label} width={280}/><figcaption>{p.label}<br/>{p.width} × {p.height}{p.upscaled&&' · ampliada: revisa nitidez'}</figcaption></figure>)}</div>
   <label className="check"><input type="checkbox" disabled={busy||locked} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>He revisado el público, presupuesto, anuncios y recortes. No es publicidad de categorías especiales. Autorizo enviar los materiales y crear estos recursos pausados.</label>
   {!review.write_available&&<p className="notice">Configura el acceso de escritura en Integraciones.</p>}
   <button type="button" className="btn primary" disabled={busy||locked||!confirmed||!review.write_available} onClick={()=>void task(async()=>{const result=await api('begin',{selection:review.selection,fingerprint:review.fingerprint,confirmed,request_id:crypto.randomUUID()});setRunId(result.run_id);setReview(null);setConfirmed(false);await execute(result.run_id);})}>Confirmar y enviar a Meta</button>
  </section>}
  {!!runs.length&&<div className="monitoring-block"><h4>Borradores anteriores</h4>{runs.map(r=><p key={r.id}>{new Date(r.created_at).toLocaleString()}<button type="button" className="btn" disabled={busy||locked} onClick={()=>void task(async()=>{setRunId(r.id);await execute(r.id);})}>Continuar borrador aprobado</button></p>)}</div>}
  {busy&&runId&&<button type="button" className="btn" onClick={()=>{stop.current=true;}}>Detener al terminar este paso</button>}
  {message&&<p className="notice" role="status">{message}</p>}{error&&<p className="error" role="alert">{error} {/(píxel|Integraciones|token)/i.test(error)?'Revisa esa conexión en Integraciones. El objetivo y el evento se ajustan mediante el prompt.':'Corrige esos datos mediante el prompt en Editar ficha → Preparar con IA.'}</p>}
 </details>;
}

'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Item} from '@/lib/model';
import type {GoogleRecipe} from '@/lib/google-ads-build';
export function GoogleAdsPreparation({experiment,editable,locked,onBusy,onSaved}:{experiment:Item;editable:boolean;locked:boolean;onBusy:(v:boolean)=>void;onSaved:()=>Promise<void>}){
 const [review,setReview]=useState<{fingerprint:string;recipe:GoogleRecipe}|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [receipt,setReceipt]=useState<{type:string;id:string;label:string}[]>([]);
 const flight=useRef(false),active=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>{active.current=true;setReview(null);setConfirmed(false);setReceipt([]);setError('');setMessage('');return()=>{active.current=false;controller.current?.abort();};},[experiment.id,experiment.updated_at]);
 async function run(action:'review'|'create'){
  if(flight.current||locked)return;flight.current=true;setBusy(true);setError('');setMessage('');onBusy(true);controller.current=new AbortController();
  try{
   const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error('Inicia sesión para continuar.');
   const response=await fetch('/api/google-ads/prepare',{method:'POST',signal:controller.current.signal,headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action,project_id:experiment.project_id,experiment_id:experiment.id,...(action==='create'?{confirmed,fingerprint:review?.fingerprint,request_id:crypto.randomUUID()}:{})})});
   const result=await response.json();if(!active.current)return;
   if(result.resources)setReceipt(result.resources);
   if(!response.ok)throw new Error(result.error||'No se pudo preparar Google Ads.');
   if(action==='review'){setReview(result);setConfirmed(false);setMessage('Google validó los parámetros sin crear recursos. Revisa esta configuración.');}
   else{setReview(null);setConfirmed(false);setMessage('Google confirmó una campaña, un grupo y dos anuncios pausados. Revisa y activa manualmente en Google Ads.');await onSaved();}
  }catch(err){if(active.current)setError(err instanceof Error?err.message:'No se pudo completar el envío.');}
  finally{flight.current=false;onBusy(false);if(active.current)setBusy(false);}
 }
 if(experiment.fields.channel!=='google_ads')return null;
 return <details className="monitoring-block" open><summary>Revisar envío a Google Ads</summary>
  <p className="small">Guarda la ficha y conecta Google Ads en Integraciones. Esta primera preparación crea una campaña de Búsqueda, un grupo y dos anuncios de texto pausados. La activación se realiza manualmente en Google Ads.</p>
  {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
  {editable&&<button type="button" className="btn" disabled={busy||locked} onClick={()=>{setReview(null);setConfirmed(false);void run('review');}}>Validar y revisar en Google</button>}
  {review&&<div><strong>{review.recipe.name}</strong><p>Cuenta {review.recipe.account_id} · {review.recipe.daily} {review.recipe.currency} / día medio · {review.recipe.start} → {review.recipe.end}</p>
   <p className="small">Solo Google Search · países {review.recipe.countries.join(', ')} · idiomas {review.recipe.languages.map(id=>id==='1000'?'Inglés':id==='1003'?'Español':id).join(', ')} · Maximizar clics, CPC máximo {review.recipe.cpc} {review.recipe.currency} · concordancia {review.recipe.match}</p>
   <a href={review.recipe.destination} target="_blank" rel="noopener noreferrer">Revisar enlace de destino</a>
   <p>Palabras clave: {review.recipe.keywords.join(', ')}</p>
   {review.recipe.variants.map(v=><div className="monitoring-entry" key={v.id}><div><strong>{v.label}</strong><p>{v.headlines.join(' · ')}</p>{v.descriptions.map(d=><p key={d}>{d}</p>)}</div></div>)}
   <p className="notice">Google optimiza la rotación; estos dos anuncios no constituyen una prueba aleatoria 50/50. La validación técnica no garantiza aprobación publicitaria. El presupuesto medio permite variaciones de gasto diario cuando actives la campaña.</p>
   <label className="check"><input type="checkbox" disabled={busy||locked} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>He revisado contenido, destino, idiomas, segmentación y presupuesto. Autorizo crear estos recursos pausados.</label>
   <button type="button" className="btn primary" disabled={busy||locked||!confirmed} onClick={()=>void run('create')}>Enviar a Google Ads · crear pausados</button>
  </div>}
  {receipt.length>0&&<div><p>IDs confirmados por Google:</p>{receipt.map(v=><p key={`${v.type}-${v.id}`}>{v.label} · {v.type} · {v.id}</p>)}<a href="https://ads.google.com/" target="_blank" rel="noopener noreferrer">Abrir Google Ads</a></div>}
  {!editable&&<p className="notice">Necesitas permiso para editar experimentos para preparar campañas.</p>}
 </details>;
}

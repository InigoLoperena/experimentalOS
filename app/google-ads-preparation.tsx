'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Item} from '@/lib/model';
import type {GoogleRecipe,GoogleImage} from '@/lib/google-ads-build';
export function GoogleAdsPreparation({experiment,editable,locked,onBusy,onSaved,openOnArrival=false}:{experiment:Item;editable:boolean;locked:boolean;onBusy:(v:boolean)=>void;onSaved:()=>Promise<void>;openOnArrival?:boolean}){
 const [review,setReview]=useState<{fingerprint:string;recipe:GoogleRecipe;previews:Omit<GoogleImage,'bytes'>[]}|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const panel=useRef<HTMLDetailsElement>(null);
 const [receipt,setReceipt]=useState<{type:string;id:string;label:string}[]>([]);
 const flight=useRef(false),active=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>{active.current=true;setReview(null);setConfirmed(false);setReceipt([]);setError('');setMessage('');return()=>{active.current=false;controller.current?.abort();};},[experiment.id,experiment.updated_at]);
 useEffect(()=>{if(openOnArrival){panel.current?.scrollIntoView({block:'start'});panel.current?.querySelector('summary')?.focus();}},[openOnArrival]);
 useEffect(()=>{let cancelled=false;if(experiment.fields.channel==='google_ads'&&supabase)void supabase.from('external_resources').select('resource_type,external_id,label').eq('workspace_id',experiment.workspace_id).eq('project_id',experiment.project_id!).eq('experiment_id',experiment.id).eq('provider','google_ads').then(({data,error})=>{if(cancelled)return;if(error)setError('No se pudo consultar el estado guardado de Google Ads.');else setReceipt((data||[]).filter(r=>r.external_id).map(r=>({type:r.resource_type,id:r.external_id!,label:r.label})));});return()=>{cancelled=true;};},[experiment.id,experiment.project_id,experiment.workspace_id]);
 async function run(action:'review'|'create'){
  if(flight.current||locked)return;flight.current=true;setBusy(true);setError('');setMessage('');onBusy(true);controller.current=new AbortController();
  try{
   const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error('Inicia sesión para continuar.');
   const response=await fetch('/api/google-ads/prepare',{method:'POST',signal:controller.current.signal,headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action,project_id:experiment.project_id,experiment_id:experiment.id,...(action==='create'?{confirmed,fingerprint:review?.fingerprint,request_id:crypto.randomUUID()}:{})})});
   let result;try{result=await response.json();}catch{throw new Error('El servidor no confirmó el envío. Actualiza y comprueba Google Ads antes de reintentar.');}if(!active.current)return;
   if(result.resources)setReceipt(result.resources);
   if(!response.ok)throw new Error(result.error||'No se pudo preparar Google Ads.');
   if(action==='review'){setReview(result);setConfirmed(false);setMessage('Google validó los parámetros sin crear recursos. Revisa esta configuración.');}
   else{setReview(null);setConfirmed(false);setMessage('Google confirmó una campaña, un grupo y dos anuncios pausados. Revisa y activa manualmente en Google Ads.');await onSaved();}
  }catch(err){if(active.current)setError(err instanceof Error?err.message:'No se pudo completar el envío.');}
  finally{flight.current=false;onBusy(false);if(active.current)setBusy(false);}
 }
 if(experiment.fields.channel!=='google_ads')return null;
 return <details ref={panel} className="monitoring-block" open><summary>Enviar a Google Ads</summary>
  <p className="small">La IA prepara la ficha; guardar no envía la campaña. Revisa aquí Búsqueda o Display y confirma la creación de recursos pausados. La activación final se hace en Google Ads.</p>
  {error&&<p className="error" role="alert">{error} {/OAuth|Integraciones|conexión|Cloud|cuenta/i.test(error)?'Revisa los accesos en Integraciones → Google Ads.':'Corrige esos datos mediante el prompt en Editar ficha → Preparar con IA.'}</p>}{message&&<p className="notice" role="status">{message}</p>}
  {editable&&<button type="button" className="btn primary" disabled={busy||locked} onClick={()=>{setReview(null);setConfirmed(false);void run('review');}}>{busy?'Comprobando…':'Enviar a Google Ads · revisar borrador'}</button>}
  {review&&<div><strong>{review.recipe.name}</strong><p>Cuenta {review.recipe.account_id} · {review.recipe.daily} {review.recipe.currency} / día medio · {review.recipe.start} → {review.recipe.end||'sin fecha final'}</p>
   <p className="small">{review.recipe.type==='DISPLAY'?'Display · CPC manual':'Búsqueda · Maximizar clics'} · países {review.recipe.countries.join(', ')} · idiomas {review.recipe.languages.map(id=>id==='1000'?'Inglés':id==='1003'?'Español':id).join(', ')} · CPC máximo {review.recipe.cpc} {review.recipe.currency}</p>
   <a href={review.recipe.destination} target="_blank" rel="noopener noreferrer">Revisar enlace de destino</a>
   {review.recipe.type==='SEARCH'?<p>Palabras clave: {review.recipe.keywords.join(', ')} · {review.recipe.match}</p>:<p>Marca: {review.recipe.business_name}. Público amplio dentro de los países e idiomas indicados; no se aplican intereses descritos en el prompt.</p>}
   {review.recipe.variants.map(v=><div className="monitoring-entry" key={v.id}><div><strong>{v.label}</strong><p>{v.headlines.join(' · ')}</p>{v.long_headline&&<p>{v.long_headline}</p>}{v.descriptions.map(d=><p key={d}>{d}</p>)}</div></div>)}
   {!!review.previews?.length&&<div className="meta-previews">{review.previews.map(image=><figure key={`${image.variant}-${image.format}`}><img src={image.preview} alt={`${image.name} · ${image.format}`} width={280}/><figcaption>{image.name} · {image.width} × {image.height}{image.upscaled?' · ampliada: revisa nitidez':''}</figcaption></figure>)}</div>}
   <p className="notice">Google optimiza la rotación; estos dos anuncios no constituyen una prueba aleatoria 50/50. La validación técnica no garantiza aprobación publicitaria. El presupuesto medio permite variaciones de gasto diario cuando actives la campaña.</p>
   <label className="check"><input type="checkbox" disabled={busy||locked} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>He revisado contenido, imágenes y recortes, destino, idiomas, segmentación y presupuesto. Autorizo crear estos recursos pausados.</label>
   <button type="button" className="btn primary" disabled={busy||locked||!confirmed} onClick={()=>void run('create')}>Confirmar y crear borrador en Google Ads</button>
  </div>}
  {receipt.length>0&&<div><p>IDs confirmados por Google:</p>{receipt.map(v=><p key={`${v.type}-${v.id}`}>{v.label} · {v.type} · {v.id}</p>)}<a href="https://ads.google.com/" target="_blank" rel="noopener noreferrer">Abrir Google Ads</a></div>}
  {!editable&&<p className="notice">Necesitas permiso para editar experimentos para preparar campañas.</p>}
 </details>;
}

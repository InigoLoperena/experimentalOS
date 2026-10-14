'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Item} from '@/lib/model';
import type {GoogleImage} from '@/lib/google-ads-build';
import {googleDeliveryState,type GoogleDeliveryStatus} from '@/lib/google-delivery';
type Review={fingerprint:string;previews:Omit<GoogleImage,'bytes'>[]};
export function GoogleAdsPreparation({experiment,editable,locked,onBusy,onSaved,openOnArrival=false}:{experiment:Item;editable:boolean;locked:boolean;onBusy:(v:boolean)=>void;onSaved:()=>Promise<void>;openOnArrival?:boolean}){
 const [status,setStatus]=useState<GoogleDeliveryStatus>({campaigns:[],pending:false}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[review,setReview]=useState<Review|null>(null);
 const panel=useRef<HTMLElement>(null),cropDialog=useRef<HTMLDialogElement>(null),flight=useRef(false),arrival=useRef(false),controller=useRef<AbortController|null>(null),mounted=useRef(false);
 useEffect(()=>{const dialog=cropDialog.current;if(review)dialog?.showModal();return()=>dialog?.close();},[review]);
 async function request(path:string,body:Record<string,unknown>,signal?:AbortSignal){
  const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error('Inicia sesión para continuar.');
  const response=await fetch(path,{method:'POST',signal,headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({project_id:experiment.project_id,experiment_id:experiment.id,...body})});
  let result;try{result=await response.json();}catch{throw new Error('El servidor no confirmó el envío. Comprueba Google Ads antes de repetirlo.');}
  if(result.resources&&mounted.current)setStatus({pending:false,campaigns:result.resources.filter((r:{type:string})=>r.type==='campaign').map((r:{id:string;label:string})=>({id:r.id,name:r.label,status:'paused',live:false}))});
  if(!response.ok)throw new Error(result.error||'No se pudo completar el envío a Google Ads.');
  return result;
 }
 useEffect(()=>{
  mounted.current=true;arrival.current=false;setLoading(true);setStatus({campaigns:[],pending:false});setReview(null);setError('');setMessage('');
  const abort=new AbortController();
  void request('/api/google-ads',{action:'status'},abort.signal).then(result=>{if(!abort.signal.aborted)setStatus(result);}).catch(err=>{if(!abort.signal.aborted)setError(err.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return()=>{mounted.current=false;abort.abort();controller.current?.abort();};
 },[experiment.id,experiment.project_id,experiment.workspace_id]);
 async function send(approved?:Review){
  if(flight.current||locked||!editable||status.pending||status.campaigns.length)return;
  flight.current=true;setBusy(true);setError('');setMessage('');onBusy(true);controller.current=new AbortController();
  try{
   const proposal:Review=approved||await request('/api/google-ads/prepare',{action:'review'},controller.current.signal);
   if(!mounted.current||controller.current.signal.aborted)return;
   // Only image crops need approval here. Campaign settings stay in Google Ads.
   if(!approved&&proposal.previews?.length){setReview(proposal);return;}
   await request('/api/google-ads/prepare',{action:'create',confirmed:true,fingerprint:proposal.fingerprint,request_id:crypto.randomUUID()},controller.current.signal);
   if(!mounted.current)return;setReview(null);setMessage('Campaña y dos anuncios creados en Google Ads. Están pausados para revisarlos allí.');await onSaved();
  }catch(err){if(mounted.current){setError(err instanceof Error?err.message:'No se pudo enviar a Google Ads.');try{const observed=await request('/api/google-ads',{action:'status'},controller.current.signal);if(mounted.current)setStatus(previous=>({...observed,campaigns:observed.campaigns.length?observed.campaigns:previous.campaigns}));}catch{/* Preserve confirmed IDs and the original failure. */}}}
  finally{flight.current=false;onBusy(false);if(mounted.current)setBusy(false);}
 }
 const sendRef=useRef(send);sendRef.current=send;
 useEffect(()=>{if(openOnArrival&&!loading&&!arrival.current&&!error){arrival.current=true;panel.current?.scrollIntoView({block:'start'});void sendRef.current();}},[openOnArrival,loading,error]);
 async function refresh(){
  if(flight.current)return;flight.current=true;setBusy(true);setError('');onBusy(true);controller.current=new AbortController();
  try{const result=await request('/api/google-ads',{action:'status',refresh:true},controller.current.signal);if(mounted.current)setStatus(result);}
  catch(err){if(mounted.current)setError(err instanceof Error?err.message:'No se pudo consultar Google Ads.');}
  finally{flight.current=false;onBusy(false);if(mounted.current)setBusy(false);}
 }
 if(experiment.fields.channel!=='google_ads')return null;
 return <section ref={panel} aria-label="Estado de la campaña">
  {loading?<p role="status">Comprobando envío…</p>:<GoogleDeliveryView status={status} title={experiment.title}/>}
  {error&&<p className="error" role="alert">{error} {/OAuth|Integraciones|conexión|Cloud|cuenta/i.test(error)?'Revisa Integraciones → Google Ads.':'Puedes corregir los datos desde Editar ficha → Preparar con IA.'}</p>}
  {message&&<p role="status">{message}</p>}
  {!loading&&editable&&!status.pending&&!status.campaigns.length&&<button type="button" className="btn primary" disabled={busy||locked||!!review} onClick={()=>void send()}>{busy?'Enviando…':'Enviar a Google Ads'}</button>}
  {!loading&&(!!status.campaigns.length||status.pending)&&<button type="button" className="btn" disabled={busy||locked} onClick={()=>void refresh()}>{busy?'Comprobando…':'Actualizar estado'}</button>}
  {review&&<dialog ref={cropDialog} className="edit-dialog" aria-label="Aprobar recortes de imágenes" onCancel={e=>{if(busy)e.preventDefault();else setReview(null);}}><h2>Aprobar recortes de imágenes</h2><div className="meta-previews">{review.previews.map(image=><figure key={`${image.variant}-${image.format}`}><img src={image.preview} alt={`${image.name} · ${image.format}`} width={280}/><figcaption>{image.name} · {image.width} × {image.height}{image.upscaled?' · ampliada: revisa nitidez':''}</figcaption></figure>)}</div><p>La campaña se enviará pausada. Revisa su configuración final en Google Ads.</p><button type="button" className="btn" disabled={busy} onClick={()=>setReview(null)}>Cancelar</button><button type="button" className="btn primary" disabled={busy||locked} onClick={()=>void send(review)}>Aprobar recortes y enviar a Google Ads</button></dialog>}
 </section>;
}
export function GoogleDeliveryView({status,title}:{status:GoogleDeliveryStatus;title:string}){
 return <>{status.campaigns.length?status.campaigns.map(c=><div key={c.id}><p><strong>Campaña:</strong> {c.name||`Experimento · ${title}`}</p><p role="status">{googleDeliveryState(c)} · ID {c.id}{!c.live?' (estado guardado)':''}</p><a href={`https://ads.google.com/aw/campaigns?campaignId=${encodeURIComponent(c.id)}`} target="_blank" rel="noopener noreferrer">Abrir campaña en Google Ads</a></div>):<><p><strong>Campaña:</strong> Experimento · {title}</p><p role="status">{status.pending?'Envío pendiente de confirmar. Comprueba Google Ads antes de repetirlo.':'Todavía no enviada a Google Ads.'}</p></>}</>;
}

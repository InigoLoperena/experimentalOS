'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Item} from '@/lib/model';
type Delivery={id:string|null;name:string;status:string|null;url:string|null;flag_key:string|null;pending:boolean;notes?:string[];record?:Item};
export function PosthogPreparation({experiment,editable,onBusy,onSaved,openOnArrival=false}:{experiment:Item;editable:boolean;onBusy:(v:boolean)=>void;onSaved:(record:Item)=>void;openOnArrival?:boolean}){
 const [delivery,setDelivery]=useState<Delivery|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const flight=useRef(false),mounted=useRef(false),arrival=useRef(false),controller=useRef<AbortController|null>(null);
 async function request(body:Record<string,unknown>,signal?:AbortSignal){
  const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error('Inicia sesión para continuar.');
  const response=await fetch('/api/posthog/prepare',{method:'POST',signal,headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({project_id:experiment.project_id,experiment_id:experiment.id,...body})});
  let value;try{value=await response.json();}catch{throw new Error('El servidor no confirmó la respuesta. Actualiza el estado antes de repetir el envío.');}
  if(!response.ok)throw new Error(value.error||'No se pudo conectar con PostHog.');return value;
 }
 useEffect(()=>{
  mounted.current=true;arrival.current=false;setDelivery(null);setError('');setLoading(true);
  const abort=new AbortController();
  void request({action:'status'},abort.signal).then(value=>{if(!abort.signal.aborted)setDelivery(value);}).catch(err=>{if(!abort.signal.aborted)setError(err.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return()=>{mounted.current=false;abort.abort();controller.current?.abort();};
 },[experiment.id,experiment.project_id,experiment.workspace_id]);
 async function run(send:boolean){
  if(flight.current||send&&(!editable||delivery?.id||delivery?.pending))return;
  flight.current=true;setBusy(true);setError('');onBusy(true);controller.current=new AbortController();
  try{
   let result:Delivery;
   if(send){const review=await request({action:'review'},controller.current.signal);result=await request({action:'create',confirmed:true,fingerprint:review.fingerprint,request_id:crypto.randomUUID()},controller.current.signal);}
   else result=await request({action:'status',refresh:true},controller.current.signal);
   if(mounted.current){setDelivery(result);if(result.record)onSaved(result.record);}
  }catch(err){if(mounted.current){setError(err instanceof Error?err.message:'No se pudo confirmar PostHog.');try{const status=await request({action:'status'},controller.current.signal);if(mounted.current)setDelivery(status);}catch{/* Preserve the original error. */}}}
  finally{flight.current=false;onBusy(false);if(mounted.current)setBusy(false);}
 }
 const runRef=useRef(run);runRef.current=run;
 useEffect(()=>{if(openOnArrival&&!loading&&!arrival.current&&!error){arrival.current=true;void runRef.current(true);}},[openOnArrival,loading,error]);
 return <section aria-label="Envío del experimento a PostHog">
  {loading?<p role="status">Comprobando PostHog…</p>:<>
   <p><strong>Experimento en PostHog:</strong> {delivery?.name||`Experimento · ${experiment.title}`}</p>
   <p role="status">{delivery?.status|| (delivery?.pending?'Envío pendiente de confirmar. Actualiza el estado antes de repetir.':'Todavía no enviado a PostHog.')}{delivery?.id&&` · ID ${delivery.id}`}</p>
   {delivery?.url&&<a href={delivery.url} target="_blank" rel="noopener noreferrer">Abrir experimento en PostHog</a>}
   {delivery?.id&&<p className="small">La web/app debe implementar la feature flag y medir el evento. Revisa la configuración y activa manualmente en PostHog.{delivery.flag_key&&` Clave: ${delivery.flag_key}.`}</p>}
   {delivery?.notes?.map((note,i)=><p key={i} className="small">{note}</p>)}
   {editable&&!delivery?.id&&!delivery?.pending&&<button type="button" className="btn primary" disabled={busy} onClick={()=>void run(true)}>{busy?'Enviando…':'Enviar a PostHog'}</button>}
   <button type="button" className="btn" disabled={busy} onClick={()=>void run(false)}>{busy?'Comprobando…':'Actualizar estado de PostHog'}</button>
  </>}
  {error&&<p role="alert" className="error">{error}</p>}
 </section>;
}

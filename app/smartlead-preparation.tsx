'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Item} from '@/lib/model';
import type {SmartleadRecipe} from '@/lib/smartlead-build';
export function SmartleadPreparation({experiment,editable,locked,onBusy,onSaved}:{experiment:Item;editable:boolean;locked:boolean;onBusy:(v:boolean)=>void;onSaved:()=>Promise<void>}){
 const [review,setReview]=useState<{fingerprint:string;recipe:SmartleadRecipe}|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [receipt,setReceipt]=useState<{type:string;id:string;label:string}[]>([]);
 const flight=useRef(false),active=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>{active.current=true;setReview(null);setConfirmed(false);setReceipt([]);setError('');setMessage('');return()=>{active.current=false;controller.current?.abort();};},[experiment.id,experiment.updated_at]);
 async function run(action:'review'|'create'){
  if(flight.current||locked)return;flight.current=true;setBusy(true);setError('');setMessage('');onBusy(true);controller.current=new AbortController();
  try{
   const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error('Inicia sesión para continuar.');
   const response=await fetch('/api/smartlead/prepare',{method:'POST',signal:controller.current.signal,headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action,project_id:experiment.project_id,experiment_id:experiment.id,...(action==='create'?{confirmed,fingerprint:review?.fingerprint,request_id:crypto.randomUUID()}:{})})});
   const result=await response.json();if(!active.current)return;
   if(result.resources)setReceipt(result.resources);
   if(!response.ok)throw new Error(result.error||'No se pudo preparar Smartlead.');
   if(action==='review'){setReview(result);setConfirmed(false);setMessage('Conexión comprobada. Revisa los asuntos y textos antes de crear el borrador.');}
   else{setReview(null);setConfirmed(false);setMessage('Smartlead confirmó el borrador y las dos variantes. Completa remitentes y destinatarios y activa manualmente en Smartlead.');await onSaved();}
  }catch(err){if(active.current)setError(err instanceof Error?err.message:'No se pudo completar el envío.');}
  finally{flight.current=false;onBusy(false);if(active.current)setBusy(false);}
 }
 if(experiment.fields.channel!=='smartlead')return null;
 return <details className="monitoring-block" open><summary>Revisar envío a Smartlead</summary>
  <p className="small">Guarda la ficha y conecta Smartlead en Integraciones. Esta preparación crea una campaña de correo con dos variantes A/B en borrador. La activación se realiza manualmente en Smartlead.</p>
  {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
  {editable&&<button type="button" className="btn" disabled={busy||locked} onClick={()=>{setReview(null);setConfirmed(false);void run('review');}}>Revisar borrador de Smartlead</button>}
  {review&&<div><strong>{review.recipe.name}</strong>
   {review.recipe.variants.map(v=><div className="monitoring-entry" key={v.id}><div><strong>{v.label} · {v.allocation}%</strong><p>{v.subject}</p><p style={{whiteSpace:'pre-wrap'}}>{v.body}</p></div></div>)}
   <p className="notice">Se crea un borrador con dos variantes del primer correo. Remitentes, destinatarios, horario y activación se revisan en Smartlead. La revisión local no equivale a una validación de entrega.</p>
   <label className="check"><input type="checkbox" disabled={busy||locked} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>He revisado las dos variantes. Autorizo crear este borrador, sin enviar correos.</label>
   <button type="button" className="btn primary" disabled={busy||locked||!confirmed} onClick={()=>void run('create')}>Enviar a Smartlead · crear borrador</button>
  </div>}
  {receipt.length>0&&<div><p>IDs confirmados por Smartlead:</p>{receipt.map(v=><p key={`${v.type}-${v.id}`}>{v.label} · {v.type} · {v.id}</p>)}<a href="https://app.smartlead.ai/" target="_blank" rel="noopener noreferrer">Abrir Smartlead</a></div>}
  {!editable&&<p className="notice">Necesitas permiso para editar experimentos para preparar campañas.</p>}
 </details>;
}

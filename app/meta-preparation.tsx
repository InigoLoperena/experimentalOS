'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Item} from '@/lib/model';
import type {MetaAccount} from '@/lib/meta-ads';
type Review={account:MetaAccount;name:string;objective:string;status:string;fingerprint:string;revision:string;write_available:boolean;previous:{status:string;external_id:string|null}|null};
export function MetaPreparation({experiment,locked,onBusy,onCreated}:{experiment:Item;locked:boolean;onBusy:(busy:boolean)=>void;onCreated:()=>Promise<void>}){
  const [categoryConfirmed,setCategoryConfirmed]=useState(false);
  const [confirmed,setConfirmed]=useState(false);
  const [review,setReview]=useState<Review|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState<{external_id:string;url:string}|null>(null);
  const active=useRef(false),flight=useRef(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  async function run(action:'review'|'create'){
    if(flight.current||locked)return;flight.current=true;setBusy(true);onBusy(true);setError('');
    try{
      const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error('Inicia sesión para continuar.');
      const response=await fetch('/api/meta/prepare',{method:'POST',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action,project_id:experiment.project_id,experiment_id:experiment.id,category:categoryConfirmed?'NONE':null,...(action==='create'?{confirmed,fingerprint:review?.fingerprint,revision:review?.revision,request_id:crypto.randomUUID()}: {})})});
      const value=await response.json();
      if(active.current&&value.external_id&&value.url)setResult(value);
      if(!response.ok)throw new Error(value.error||'No se pudo preparar la campaña.');
      if(action==='review'){if(active.current){setReview(value);setConfirmed(false);}}
      else{await onCreated();if(active.current)setReview(previous=>previous&&({...previous,previous:{status:'linked',external_id:value.external_id}}));}
    }catch(err){if(active.current)setError(err instanceof Error?err.message:'No se pudo preparar la campaña.');}
    finally{flight.current=false;onBusy(false);if(active.current)setBusy(false);}
  }
  if(experiment.fields.channel!=='meta_ads')return null;
  const blocked=!!review?.previous&&review.previous.status!=='rejected';
  return <details className="monitoring-block"><summary>Crear solo una campaña vacía pausada · tráfico</summary>
    <p className="small">Primer paso para campañas de tráfico a una web: crear una campaña vacía y pausada con el código del experimento y guardar su ID automáticamente. Los anuncios, las creatividades, la segmentación y el presupuesto se completarán después en Meta. Esta operación no activa publicidad.</p>
    <label className="check"><input type="checkbox" disabled={busy||locked} checked={categoryConfirmed} onChange={e=>{setCategoryConfirmed(e.target.checked);setReview(null);setConfirmed(false);}}/>Confirmo que no es publicidad de categorías especiales (vivienda, empleo, crédito, política u otras reguladas por Meta).</label>
    <button className="btn" type="button" disabled={busy||locked||!categoryConfirmed} onClick={()=>void run('review')}>{busy?'Consultando Meta…':'Revisar preparación y cuenta'}</button>
    {review&&<><p className="notice">Cuenta: {review.account.name} · {review.account.currency}<br/>Campaña: {review.name}<br/>Objetivo: {review.objective} · Estado solicitado: Pausado</p>
      {blocked&&<p className="notice">{review.previous?.status==='linked'?`La campaña ya está vinculada: ${review.previous.external_id}. Consulta los recursos de este experimento.`:'Ya hay una creación pendiente o sin confirmar. Revisa Ads Manager y vincula su ID antes de repetir.'}</p>}
      {!review.write_available&&<p className="notice">La conexión actual permite consultar campañas. Para crearlas falta configurar el permiso ads_management y el token de escritura en el servidor.</p>}
      {review.write_available&&!blocked&&<><label className="check"><input type="checkbox" disabled={busy||locked} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Autorizo crear esta campaña vacía y pausada en la cuenta indicada.</label><button className="btn primary" type="button" disabled={busy||locked||!confirmed} onClick={()=>void run('create')}>Crear campaña pausada y vincularla</button></>}
    </>}
    {error&&<p className="error" role="alert">{error}</p>}
    {result&&<p className="notice" role="status">Campaña creada pausada · ID {result.external_id}. <a className="project-link" href={result.url} target="_blank" rel="noopener noreferrer">Revisar en Meta</a></p>}
  </details>;
}

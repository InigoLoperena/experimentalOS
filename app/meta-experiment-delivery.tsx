'use client';

import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Item} from '@/lib/model';
import {safeResourceUrl,type ExternalResource} from '@/lib/monitoring';
import {MetaCampaignBuilder} from './meta-campaign-builder';

export function MetaExperimentDelivery({experiment,editable,demo,onBusy,openOnArrival=false}:{
 experiment:Item;editable:boolean;demo:boolean;onBusy:(busy:boolean)=>void;openOnArrival?:boolean;
}){
 const [resources,setResources]=useState<ExternalResource[]>([]);
 const [connection,setConnection]=useState<boolean|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let cancelled=false;
  if(demo||!supabase){setLoading(false);return;}
  const client=supabase;
  setLoading(true);setError('');
  void Promise.all([
   client.from('external_resources').select('*').eq('workspace_id',experiment.workspace_id).eq('project_id',experiment.project_id!).eq('experiment_id',experiment.id).eq('provider','meta_ads').order('created_at'),
   client.from('integration_connections').select('enabled,project_id,workspace_default').eq('workspace_id',experiment.workspace_id).eq('provider','meta_ads'),
  ]).then(([linked,configured])=>{
   if(cancelled)return;
   if(linked.error||configured.error)throw new Error('No se pudo comprobar el estado de la campaña. Pulsa actualizar.');
   const selected=configured.data?.find(c=>c.project_id===experiment.project_id)||configured.data?.find(c=>c.workspace_default);
   setResources(linked.data as ExternalResource[]);setConnection(selected?.enabled===true);
  }).catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'No se pudo comprobar el envío.');})
   .finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[experiment.id,experiment.project_id,experiment.workspace_id,demo,revision]);
 const campaigns=resources.filter(r=>r.resource_type==='campaign'&&r.external_id);
 const ads=resources.filter(r=>r.resource_type==='ad'&&r.external_id);
 return <section aria-label="Estado del envío a Meta">
  {loading?<p role="status">Comprobando campaña…</p>:error?<p className="error" role="alert">{error}</p>:<>
   {campaigns.length?campaigns.map(c=>{
    let url:string|null=null;try{url=c.external_url?safeResourceUrl(c.external_url):null;}catch{/* Invalid historical links must not break the detail. */}
    return <div key={c.id}><p role="status"><strong>Campaña creada en Meta</strong> · ID {c.external_id}</p>
     {c.observed_status==='paused'&&<p className="small">Pausada (último estado guardado)</p>}
     {url&&<a href={url} target="_blank" rel="noopener noreferrer">Abrir en Meta</a>}
    </div>;
   }):<p role="status">La campaña todavía no se ha creado en Meta. Guardar la ficha o proponer contenido con IA no la envía.</p>}
   {!!campaigns.length&&<p className="small">{ads.length?`${ads.length} anuncios vinculados a este experimento.`:'Todavía no hay anuncios vinculados; la preparación está incompleta.'}</p>}
   {!demo&&connection===false&&<p className="error" role="alert">Este proyecto no tiene una conexión activa de Meta. Configúrala en Integraciones para poder enviar el experimento.</p>}
  </>}
  {!demo&&<button type="button" className="btn" disabled={loading||busy} onClick={()=>setRevision(r=>r+1)}>Actualizar estado</button>}
  {!demo&&editable&&connection===true&&<MetaCampaignBuilder experiment={experiment} openOnArrival={openOnArrival} locked={busy||loading||!!error} onBusy={value=>{setBusy(value);onBusy(value);}} onCreated={async()=>{setRevision(r=>r+1);}}/>}
 </section>;
}

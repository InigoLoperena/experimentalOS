'use client';
import {useEffect,useRef,useState} from 'react';
import type {Item} from '@/lib/model';
import type {MetricoolPost,MetricoolNetwork} from '@/lib/metricool';
import {supabase} from '@/lib/supabase';
import type {ExternalResource,CsvMetric} from '@/lib/monitoring';
const networks={instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',youtube:'YouTube'};
export function MetricoolMonitoring({experiment,resources,editable,locked,onBusy,onChoose,onReview}:{experiment:Item;resources:ExternalResource[];editable:boolean;locked:boolean;onBusy:(value:boolean)=>void;onChoose:(post:MetricoolPost)=>void;onReview:(metrics:CsvMetric[])=>void}){
 const [network,setNetwork]=useState<MetricoolNetwork>('instagram');
 const [start,setStart]=useState(new Date(Date.now()-7*86400000).toISOString().slice(0,10));
 const [end,setEnd]=useState(new Date().toISOString().slice(0,10));
 const [posts,setPosts]=useState<MetricoolPost[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const flight=useRef(false),controller=useRef<AbortController|null>(null),active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort();};},[]);
 if(experiment.fields.channel!=='metricool'&&!resources.some(r=>r.provider==='metricool'))return null;
 async function load(){
  if(flight.current||locked)return;flight.current=true;setBusy(true);onBusy(true);setError('');setLoaded(false);setPosts([]);controller.current=new AbortController();
  try{
   const {data}=await supabase!.auth.getSession();if(!data.session)throw new Error('Inicia sesión para consultar Metricool.');
   const response=await fetch('/api/metricool',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({project_id:experiment.project_id,action:'posts',network,start,end}),signal:controller.current.signal});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo consultar Metricool.');
   if(active.current){setPosts(result.posts);setLoaded(true);}
  }catch(err){if(active.current)setError(err instanceof Error?err.message:'No se pudo consultar Metricool.');}
  finally{flight.current=false;onBusy(false);if(active.current)setBusy(false);}
 }
 return <details className="monitoring-block"><summary>Publicaciones de Metricool</summary>
  <p className="small">Consulta publicaciones de la marca del proyecto y vincula cada una con su variante. El acceso directo necesita un token API de Advanced o Custom, guardado en Integraciones.</p>
  <fieldset disabled={busy||locked} className="monitoring-grid"><label>Red social<select value={network} onChange={e=>{setNetwork(e.target.value as MetricoolNetwork);setPosts([]);setLoaded(false);}}>{Object.entries(networks).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Publicadas desde<input type="date" value={start} onChange={e=>{setStart(e.target.value);setPosts([]);setLoaded(false);}}/></label><label>Publicadas hasta<input type="date" value={end} onChange={e=>{setEnd(e.target.value);setPosts([]);setLoaded(false);}}/></label><button type="button" className="btn" onClick={()=>void load()}>{busy?'Consultando…':'Consultar publicaciones en Metricool'}</button></fieldset>
  {error&&<p role="alert" className="error">{error}</p>}
  {loaded&&!posts.length&&<p>No hay publicaciones en el periodo seleccionado.</p>}
  <p className="small">Las métricas son acumulados de cada publicación en el momento de la consulta. El rango selecciona cuándo se publicó; no mide solo las interacciones de esos días. Dos posts orgánicos no garantizan un A/B aleatorizado.</p>
  {posts.map(post=><div key={post.id} className="monitoring-entry"><div><strong>{post.text||post.id}</strong><p>{post.id}</p>{post.url&&<a href={post.url} target="_blank" rel="noopener noreferrer">Ver publicación</a>}<p>{post.metrics.map(m=>`${m.metric}: ${m.value}`).join(' · ')||'Sin métricas disponibles'}</p></div>{editable&&<div className="row"><button type="button" className="btn" disabled={busy||locked} onClick={()=>onChoose(post)}>Preparar vínculo</button><button type="button" className="btn" disabled={busy||locked||!post.metrics.length||!resources.some(r=>r.provider==='metricool'&&r.resource_type==='post'&&r.external_id===post.id)} onClick={()=>onReview(post.metrics)}>Revisar importación de métricas</button></div>}</div>)}
 </details>;
}

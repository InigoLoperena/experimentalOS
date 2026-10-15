"use client";

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/lib/model';
import type { GoogleAdsAccount, GoogleAdsCampaign, GoogleAdsReport } from '@/lib/google-ads';
import { metricTitle, type ExternalResource, type CsvMetric } from '@/lib/monitoring';

type Props = {experiment:Item; resources:ExternalResource[]; editable:boolean; locked:boolean;
  onChoose:(campaign:GoogleAdsCampaign)=>void; onReview:(metrics:CsvMetric[])=>void; onBusy:(busy:boolean)=>void};

async function query(projectId:string, body:Record<string,unknown>, signal:AbortSignal) {
  const {data} = await supabase!.auth.getSession();
  if (!data.session) throw new Error('Inicia sesión para consultar Google Ads.');
  const response = await fetch('/api/google-ads',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},
    body:JSON.stringify({project_id:projectId,...body}),signal});
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo consultar Google Ads.');
  return payload;
}

export function GoogleAdsMonitoring({experiment,resources,editable,locked,onChoose,onReview,onBusy}:Props) {
  const [available,setAvailable] = useState(false);
  const [account,setAccount] = useState<GoogleAdsAccount|null>(null);
  const [campaigns,setCampaigns] = useState<GoogleAdsCampaign[]|null>(null);
  
  const [report,setReport] = useState<GoogleAdsReport|null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [period,setPeriod] = useState({start:new Date(Date.now()-7*86400000).toISOString().slice(0,10),end:new Date(Date.now()-86400000).toISOString().slice(0,10)});
  const [selected,setSelected] = useState('');
  const [preview,setPreview] = useState<GoogleAdsCampaign|null>(null);
  const flight = useRef(false);
  const controller = useRef<AbortController|null>(null);
  const active = useRef(false);
  const linked = resources.filter(value=>value.provider==='google_ads' && ['campaign','adset','ad'].includes(value.resource_type) && value.external_id);
  useEffect(()=>{
    active.current=true;
    setAvailable(false);setAccount(null);setCampaigns(null);setReport(null);setSelected('');setPreview(null);setError('');
    const check = new AbortController();
    void query(experiment.project_id!,{action:'connection'},check.signal).then(value=>{if(active.current) setAvailable(value.available===true);})
      .catch(()=>{ /* Manual monitoring remains available if the connection is absent. */ });
    return ()=>{active.current=false;check.abort();controller.current?.abort();};
  },[experiment.project_id]);
  async function run(action:()=>Promise<void>) {
    if(flight.current || locked) return;
    flight.current=true;setBusy(true);setError('');onBusy(true);controller.current=new AbortController();
    try {await action();} catch(err) {if(active.current) setError(err instanceof Error ? err.message : 'No se pudo consultar Google Ads.');}
    finally {flight.current=false;onBusy(false);if(active.current) setBusy(false);}
  }
  function choose(campaign:GoogleAdsCampaign) {
    const existing=linked.find(value=>value.resource_type==='campaign' && value.external_id===campaign.id);
    if(existing) {setSelected(existing.id);setReport(null);} else onChoose(campaign);
  }
  if(!available) return experiment.fields.channel==='google_ads'?<p className="notice">Configura y comprueba Google Ads para este proyecto en Integraciones. Mientras tanto puedes vincular recursos e importar resultados manualmente.</p>:null;
  return <details className="monitoring-block">
    <summary>Conexión con Google Ads</summary>
    <p className="small">Consulta tus campañas y sus resultados. Elige una campaña para completar el vínculo existente y asignarla a una variante.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <button type="button" className="btn" disabled={busy || locked} onClick={()=>void run(async()=>{
      const result=await query(experiment.project_id!,{action:'campaigns'},controller.current!.signal);
      if(active.current) {setAccount(result.account);setCampaigns(result.campaigns);}
    })}>{busy ? 'Consultando Google Ads…' : 'Consultar campañas de Google Ads'}</button>
    {account && <p className="notice">{account.name} · {account.currency} · {account.timezone}</p>}
    {campaigns && <><div className="monitoring-list">{campaigns.map(campaign=><div className="monitoring-entry" key={campaign.id}>
      <div><strong>{campaign.name}</strong><p className="small">ID {campaign.id} · {campaign.status}</p><a className="project-link" href={campaign.url} target="_blank" rel="noopener noreferrer">Abrir en Google Ads</a></div>
      <button type="button" className="btn" disabled={busy || locked} onClick={()=>{setPreview(campaign);setSelected('preview');setReport(null);}}>Ver resultados</button>
      {editable && <button type="button" className="btn" disabled={busy || locked} onClick={()=>choose(campaign)}>{linked.some(value=>value.resource_type==='campaign' && value.external_id===campaign.id)?'Consultar vínculo':'Preparar vínculo'}</button>}
    </div>)}</div>{!campaigns.length && <p className="small">Google Ads no ha devuelto campañas para esta cuenta.</p>}
    </>}
    {(linked.length>0 || preview) && <form className="monitoring-form" onSubmit={e=>{e.preventDefault();setReport(null);void run(async()=>{
      const target=selected==='preview' && preview ? {action:'preview',external_id:preview.id} : {action:'report',resource_id:selected};
      const result=await query(experiment.project_id!,{...target,start:period.start,end:period.end},controller.current!.signal);
      if(active.current) setReport(result);
    });}}><fieldset className="monitoring-grid" disabled={busy || locked}>
      <label>Recurso de Google Ads<select required value={selected} onChange={e=>{setSelected(e.target.value);setReport(null);}}><option value="">Seleccionar</option>{preview && <option value="preview">{preview.name} · sin vincular</option>}{linked.map(value=><option key={value.id} value={value.id}>{value.label || value.external_id}</option>)}</select></label>
      <label>Desde<input required type="date" value={period.start} onChange={e=>{setPeriod({...period,start:e.target.value});setReport(null);}}/></label>
      <label>Hasta<input required type="date" value={period.end} onChange={e=>{setPeriod({...period,end:e.target.value});setReport(null);}}/></label>
      <button type="submit" className="btn">Consultar resultados de Google Ads</button>
    </fieldset></form>}
    {report && <div>{report.storage&&<p className={report.storage.saved?'small':'notice'}>{report.storage.note}</p>}<p><strong>{report.name}</strong> · {report.status}</p><p className="small">Consultado {new Date(report.fetched_at).toLocaleString('es')}. Periodo en la zona horaria de la cuenta.</p>
      <div className="monitoring-table"><table><thead><tr><th>Métrica</th><th>Valor</th><th>Periodo / fuente</th></tr></thead><tbody>{report.metrics.map(row=><tr key={row.metric}><td>{metricTitle(row.metric,row.notes)}</td><td>{row.value.toLocaleString('es')} {row.currency || ''}</td><td>{row.period_start} → {row.period_end}<br/><span className="small">{row.notes}</span></td></tr>)}</tbody></table></div>
      {!report.metrics.length && <p className="notice">Google Ads no devolvió métricas para este periodo. No se guardan ceros ni se borran resultados anteriores.</p>}
      {editable && report.resource_id && report.metrics.length>0 && <button type="button" className="btn primary" disabled={busy || locked || !linked.some(value=>value.id===report.resource_id)} onClick={()=>onReview(report.metrics)}>Revisar importación de resultados</button>}
      {!report.resource_id && report.metrics.length>0 && <p className="notice">Vincula esta campaña al experimento para revisar y guardar sus resultados.</p>}
    </div>}
    <p className="small">Los datos recientes pueden cambiar. Clics publicitarios y North Star son métricas distintas; no sumes campañas con sus grupos/anuncios ni periodos superpuestos. Hasta 31 días por consulta. Para conservar los resultados, revisa y confirma su importación.</p>
  </details>;
}


"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Download, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Item } from "@/lib/model";
import { MetaMonitoring } from './meta-monitoring';
import {MetaPreparation} from './meta-preparation';
import {MetaCampaignBuilder} from './meta-campaign-builder';
import {channelProvider} from '@/lib/monitoring';
import { csvObservationPayload, experimentScope, loadMonitoring, metricLabels, metricsCsvTemplate, parseMetricsCsv,
  periodRows, providers, safeResourceUrl, validateObservation,
  type Monitoring, type Observation, type Provider, type CsvMetric } from "@/lib/monitoring";

const statusLabels: Record<string,string> = { draft: "Borrador", prepared: "Preparado", running: "En curso",
  completed: "Finalizado", archived: "Archivado", paused: "Pausado", unknown: "Sin comprobar", unavailable: "No disponible" };
const unitLabels = { count: "Recuento", currency: "Importe", ratio: "Proporción (0–1)", number: "Número" };
const resourceLabels: Record<string,string> = {campaign:"Campaña",adset:"Conjunto de anuncios",ad:"Anuncio",post:"Publicación",experiment:"Experimento",other:"Otro"};
const today = () => new Date().toISOString().slice(0,10);

export function ExperimentMonitoring({ experiment, editable, demo, onBusy }: {
  experiment: Item; editable: boolean; demo: boolean; onBusy: (busy: boolean) => void;
}) {
  const [data, setData] = useState<Monitoring | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState({ label: "", description: "", control: false, allocation: "50" });
  const [resource, setResource] = useState({ provider: channelProvider(experiment.fields.channel), type: "campaign", id: "", url: "", label: "", variant: "" });
  const [metric, setMetric] = useState({ resource: "", key: "clicks", unit: "count" as Observation["unit"], value: "", currency: "USD", start: today(), end: today(), notes: "" });
  const [period, setPeriod] = useState({ start: today(), end: today() });
  const [csv, setCsv] = useState<CsvMetric[] | null>(null);
  const [variantEditing, setVariantEditing] = useState<string | null>(null);
  const [resourceEditing, setResourceEditing] = useState<string | null>(null);
  const active = useRef(true);
  const inFlight = useRef(false);
  const resourceDetails = useRef<HTMLDetailsElement>(null);
  const resultsDetails = useRef<HTMLDetailsElement>(null);
  const scope = experimentScope(experiment);

  useEffect(() => {
    active.current = true;
    let cancelled = false;
    if (demo) {
      setData({ spec: { ...experimentScope(experiment), code: `EXP-DEMO-${experiment.id.slice(0,8).toUpperCase()}`,
        status: "draft", budget: null, currency: "USD", budget_period: "daily", planned_start: null, planned_end: null,
        timezone: "UTC", updated_at: new Date().toISOString() }, variants: [], resources: [], observations: [] });
      setLoading(false);
    } else if (supabase) {
      setLoading(true);
      void loadMonitoring(supabase, experiment).then(value => {
        if (cancelled) return;
        setData(value);
        const last = value.observations.at(-1);
        if (last) setPeriod({ start: last.period_start, end: last.period_end });
      }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar los resultados."); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    return () => { cancelled=true; active.current=false; };
  }, [experiment.id, demo]);

  async function refresh() {
    if (!demo && supabase) {
      const value = await loadMonitoring(supabase, experiment);
      if (active.current) setData(value);
    }
  }
  async function run(task: () => Promise<void>, success = "Cambios guardados.") {
    if (inFlight.current || !editable || !data) return;
    inFlight.current=true; setBusy(true); onBusy(true); setError(""); setMessage("");
    try { await task(); await refresh(); if (active.current) setMessage(demo ? "Guardado en esta demostración." : success); }
    catch (err) { if (active.current) setError(err instanceof Error ? err.message : "No se pudo guardar."); }
    finally { inFlight.current=false; onBusy(false); if (active.current) setBusy(false); }
  }
  const write = async (table: string, payload: Record<string,unknown>, id?: string, revision?: string) => {
    let query = id ? supabase!.from(table).update(payload).eq("id",id).eq("workspace_id",scope.workspace_id)
      .eq("experiment_id",scope.experiment_id).eq("updated_at",revision!) : supabase!.from(table).insert({ ...scope, ...payload });
    const result = await query.select("*").single();
    if (result.error) throw new Error(result.error.code === "PGRST116" ? "Otra persona cambió este registro. Actualiza antes de editarlo." : result.error.message);
  };
  const remove = async (table: string, id: string) => {
    const result = await supabase!.from(table).delete().eq("workspace_id",scope.workspace_id).eq("experiment_id",scope.experiment_id).eq("id",id).select("id");
    if (result.error || !result.data?.length) throw new Error(result.error?.message || "El registro ya no está disponible o no tienes permiso.");
  };

  if (loading) return <section className="experiment-monitoring"><p>Cargando preparación y resultados…</p></section>;
  if (!data) return <section className="experiment-monitoring"><p className="error" role="alert">{error}</p>
    <button className="btn" onClick={() => { setLoading(true); setError(""); void refresh().catch(err => setError(err.message)).finally(() => setLoading(false)); }}>Reintentar</button></section>;
  const rows = periodRows(data.observations,period.start,period.end);

  return <section className="experiment-monitoring">
    <div className="monitoring-heading"><div><span className="eyebrow">PREPARACIÓN Y RESULTADOS</span><h3>{data.spec.code}</h3></div>
      {!demo && <button type="button" className="btn" disabled={busy} onClick={() => { setLoading(true); void refresh().catch(err => setError(err.message)).finally(() => setLoading(false)); }}><RefreshCw size={14}/> Actualizar</button>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    <p className="small">Prepara aquí el experimento y vincula sus campañas. La publicación se realiza manualmente en la plataforma externa.</p>
    {!demo&&editable&&<><MetaCampaignBuilder experiment={experiment} locked={busy} onBusy={value=>{setBusy(value);onBusy(value);}} onCreated={refresh}/><MetaPreparation experiment={experiment} locked={busy} onBusy={value=>{setBusy(value);onBusy(value);}} onCreated={refresh}/></>}
    <details className="monitoring-block">
      <summary>Preparación · {statusLabels[data.spec.status] || data.spec.status}</summary>
      <form className="monitoring-form" onSubmit={e => { e.preventDefault(); const form=new FormData(e.currentTarget); void run(async () => {
        const budgetText=String(form.get("budget") || "");
        const values={ status: String(form.get("status")), budget: budgetText === "" ? null : Number(budgetText),
          currency: String(form.get("currency")).toUpperCase(), budget_period: String(form.get("budget_period")),
          planned_start: String(form.get("planned_start")) || null, planned_end: String(form.get("planned_end")) || null, timezone: String(form.get("timezone")) };
        if (values.planned_start && values.planned_end && values.planned_end<values.planned_start) throw new Error("La fecha final debe ser posterior al inicio.");
        if (demo) setData(previous => previous && ({ ...previous, spec: { ...previous.spec, ...values } as Monitoring["spec"] }));
        else {
          const result=await supabase!.from("experiment_specs").update(values).eq("workspace_id",scope.workspace_id)
            .eq("experiment_id",experiment.id).eq("updated_at",data.spec.updated_at).select("experiment_id");
          if (result.error || !result.data?.length) throw new Error(result.error?.message || "La preparación cambió. Actualiza antes de guardar.");
        }
      }); }}>
        <fieldset disabled={!editable || busy} className="monitoring-grid" key={data.spec.updated_at}>
          <label>Estado<select name="status" defaultValue={data.spec.status}>{["draft","prepared","running","completed","archived"].map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
          <label>Presupuesto<input name="budget" type="number" min="0" max="1000000" step="0.01" defaultValue={data.spec.budget ?? ""}/></label>
          <label>Moneda<input name="currency" required maxLength={3} pattern="[A-Za-z]{3}" defaultValue={data.spec.currency}/></label>
          <label>Tipo de presupuesto<select name="budget_period" defaultValue={data.spec.budget_period}><option value="daily">Diario</option><option value="total">Total</option></select></label>
          <label>Inicio previsto<input name="planned_start" type="date" defaultValue={data.spec.planned_start || ""}/></label>
          <label>Fin previsto<input name="planned_end" type="date" defaultValue={data.spec.planned_end || ""}/></label>
          <label>Zona horaria<input name="timezone" required maxLength={80} defaultValue={data.spec.timezone} placeholder="America/New_York"/></label>
          {editable && <button type="submit" className="btn primary">Guardar preparación</button>}
        </fieldset>
      </form>
    </details>

    <details className="monitoring-block">
      <summary>Variantes · {data.variants.length}</summary>
      <div className="monitoring-list">{data.variants.map(value => <div key={value.id} className="monitoring-entry">
        <div><strong>{value.label}{value.is_control ? " · Control" : ""}</strong><p>{value.description}</p>
          <span className="small">{value.allocation === null ? "Sin reparto definido" : `${value.allocation} % de asignación prevista`}</span></div>
        {editable && <div className="row"><button type="button" className="btn" disabled={busy} onClick={() => { setVariantEditing(value.id); setVariant({ label:value.label, description:value.description, control:value.is_control, allocation: value.allocation === null ? "" : String(value.allocation) }); }}>Editar</button>
          <button type="button" className="icon-button" aria-label={`Eliminar variante ${value.label}`} disabled={busy} onClick={() => void run(async () => {
            if (data.resources.some(row => row.variant_id===value.id)) throw new Error("Desvincula primero los recursos de esta variante.");
            if (demo) setData(previous => previous && ({ ...previous, variants: previous.variants.filter(row => row.id!==value.id) }));
            else await remove("experiment_variants",value.id);
          })}><Trash2 size={15}/></button></div>}
      </div>)}</div>
      {editable && <form className="monitoring-form" onSubmit={e => { e.preventDefault(); void run(async () => {
        const allocation=variant.allocation==="" ? null : Number(variant.allocation);
        if (allocation!==null && (!Number.isFinite(allocation) || allocation<0 || allocation>100)) throw new Error("La asignación debe estar entre 0 y 100.");
        if (data.variants.some(value => value.id!==variantEditing && value.label===variant.label.trim())) throw new Error("Ya existe una variante con ese nombre.");
        if (variant.control && data.variants.some(value => value.id!==variantEditing && value.is_control)) throw new Error("Solo puede haber una variante de control.");
        const payload={ label: variant.label.trim(), description: variant.description.trim(), is_control: variant.control, allocation };
        const existing=data.variants.find(value => value.id===variantEditing);
        if (demo) {
          const value={ ...scope, ...payload, id: existing?.id || crypto.randomUUID(), updated_at:new Date().toISOString() };
          setData(previous => previous && ({ ...previous, variants: existing ? previous.variants.map(row => row.id===value.id ? value : row) : [...previous.variants,value] }));
        } else await write("experiment_variants",payload,existing?.id,existing?.updated_at);
        setVariantEditing(null); setVariant({ label:"",description:"",control:false,allocation:"50" });
      }); }}><fieldset disabled={busy} className="monitoring-grid">
        <label>Nombre de variante<input required maxLength={40} value={variant.label} onChange={e => setVariant({ ...variant,label:e.target.value })} placeholder="A · Muebles gratuitos"/></label>
        <label>Asignación prevista (%)<input type="number" min="0" max="100" step="0.01" value={variant.allocation} onChange={e => setVariant({ ...variant,allocation:e.target.value })}/></label>
        <label className="monitoring-wide">Mensaje o descripción<textarea maxLength={10000} value={variant.description} onChange={e => setVariant({ ...variant,description:e.target.value })}/></label>
        <label className="checkbox-label"><input type="checkbox" checked={variant.control} onChange={e => setVariant({ ...variant,control:e.target.checked })}/> Variante de control</label>
        <div className="row"><button className="btn primary" type="submit">{variantEditing ? "Guardar variante" : "Añadir variante"}</button>{variantEditing && <button className="btn" type="button" onClick={() => { setVariantEditing(null); setVariant({label:"",description:"",control:false,allocation:"50"}); }}>Cancelar</button>}</div>
      </fieldset></form>}
      <p className="small">El reparto es una planificación. Añadir variantes aquí no configura por sí solo un A/B aleatorizado en Meta.</p>
    </details>

    <details className="monitoring-block" ref={resourceDetails}>
      <summary>Campañas y recursos vinculados · {data.resources.length}</summary>
      <div className="monitoring-list">{data.resources.map(value => <div key={value.id} className="monitoring-entry">
        <div><strong>{value.label || value.external_id || "Recurso enlazado"}</strong><p>{providers[value.provider]} · {resourceLabels[value.resource_type] || value.resource_type} · {value.external_id ? `ID ${value.external_id}` : "ID pendiente"}</p>
          <span className="small">{data.variants.find(row => row.id===value.variant_id)?.label || "Todas las variantes / sin asignar"} · {statusLabels[value.observed_status]}</span>
          {value.external_url && <a className="project-link" href={value.external_url} target="_blank" rel="noopener noreferrer">Abrir plataforma <ArrowUpRight size={14}/></a>}
        </div>
        {editable && <div className="row"><button type="button" className="btn" disabled={busy} onClick={() => { setResourceEditing(value.id); setResource({provider:value.provider,type:value.resource_type,id:value.external_id || "",url:value.external_url || "",label:value.label,variant:value.variant_id || ""}); }}>Editar</button><button type="button" className="icon-button" aria-label={`Retirar vínculo ${value.label || value.external_id || "externo"}`} disabled={busy} onClick={() => {
          if (!window.confirm("Retirar este vínculo eliminará sus métricas guardadas en Experimental OS. La campaña externa seguirá existiendo. ¿Continuar?")) return;
          void run(async () => { if (demo) setData(previous => previous && ({ ...previous, resources:previous.resources.filter(row => row.id!==value.id), observations:previous.observations.filter(row => row.resource_id!==value.id) })); else await remove("external_resources",value.id); });
        }}><Trash2 size={15}/></button></div>}
      </div>)}</div>
      {editable && <form className="monitoring-form" onSubmit={e => { e.preventDefault(); void run(async () => {
        const existing=data.resources.find(value => value.id===resourceEditing);
        const payload={ provider:resource.provider,resource_type:resource.type,external_id:resource.id.trim() || null, external_url:safeResourceUrl(resource.url),label:resource.label.trim(),variant_id:resource.variant || null, observed_status:existing?.observed_status || "unknown" };
        if (!payload.external_id && !payload.external_url) throw new Error("Indica un ID o una URL de la plataforma.");
        if (data.resources.some(value => value.id!==resourceEditing && value.provider===payload.provider && value.resource_type===payload.resource_type && (payload.external_id ? value.external_id===payload.external_id : !value.external_id && value.external_url===payload.external_url))) throw new Error("Este recurso ya está vinculado.");
        if (demo) { const value={...scope,...payload,id:existing?.id || crypto.randomUUID(),updated_at:new Date().toISOString()}; setData(previous => previous && ({ ...previous,resources:existing ? previous.resources.map(row => row.id===existing.id ? value : row) : [...previous.resources,value] })); }
        else await write("external_resources",payload,existing?.id,existing?.updated_at);
        setResourceEditing(null); setResource({ ...resource,id:"",url:"",label:"",variant:"" }); setCsv(null);
      }); }}><fieldset disabled={busy} className="monitoring-grid">
        <label>Plataforma<select value={resource.provider} onChange={e => setResource({ ...resource,provider:e.target.value as Provider })}>{Object.entries(providers).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>Tipo de recurso<select value={resource.type} onChange={e => setResource({ ...resource,type:e.target.value })}>{["campaign","adset","ad","post","experiment","other"].map(id => <option key={id} value={id}>{({campaign:"Campaña",adset:"Conjunto de anuncios",ad:"Anuncio",post:"Publicación",experiment:"Experimento",other:"Otro"} as Record<string,string>)[id]}</option>)}</select></label>
        <label>ID externo<input maxLength={200} value={resource.id} onChange={e => setResource({ ...resource,id:e.target.value })}/></label>
        <label>URL externa<input type="url" maxLength={2000} value={resource.url} onChange={e => setResource({ ...resource,url:e.target.value })}/></label>
        <label>Nombre (opcional)<input maxLength={200} value={resource.label} onChange={e => setResource({ ...resource,label:e.target.value })}/></label>
        <label>Variante<select value={resource.variant} onChange={e => setResource({ ...resource,variant:e.target.value })}><option value="">Sin asignar / todas</option>{data.variants.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>
        <div className="row"><button type="submit" className="btn primary">{resourceEditing ? "Guardar vínculo" : "Vincular recurso"}</button>{resourceEditing && <button type="button" className="btn" onClick={() => { setResourceEditing(null); setResource({...resource,id:"",url:"",label:"",variant:""}); }}>Cancelar</button>}</div>
      </fieldset></form>}
      <p className="small">Indica el ID o la URL de la plataforma. Para importar resultados necesitas añadir el ID. Meta permite consultar resultados desde su conexión; las otras plataformas admiten importación manual.</p>
    </details>

    {!demo && <MetaMonitoring experiment={experiment} resources={data.resources} editable={editable} locked={busy} onBusy={onBusy}
      onChoose={campaign=>{setResourceEditing(null);setResource({provider:'meta_ads',type:'campaign',id:campaign.id,url:campaign.url,label:campaign.name,variant:''});
        if(resourceDetails.current) {resourceDetails.current.open=true;resourceDetails.current.scrollIntoView({behavior:'smooth',block:'start'});}
        setMessage('Campaña preparada en el formulario de recursos. Asigna una variante y pulsa Vincular recurso.');}}
      onReview={metrics=>{try {csvObservationPayload(experiment,data.resources,metrics);setCsv(metrics);setError('');setMessage('Resultados de Meta listos para revisión. Confirma la importación en Resultados.');
          if(resultsDetails.current) {resultsDetails.current.open=true;resultsDetails.current.scrollIntoView({behavior:'smooth',block:'start'});}}
        catch(err) {setError(err instanceof Error ? err.message : 'Revisa el vínculo antes de importar.');}}}/>}

    <details className="monitoring-block" open ref={resultsDetails}>
      <summary>Resultados · {data.observations.length} observaciones</summary>
      <div className="monitoring-grid"><label>Desde<input type="date" value={period.start} onChange={e => setPeriod({ ...period,start:e.target.value })}/></label>
        <label>Hasta<input type="date" value={period.end} onChange={e => setPeriod({ ...period,end:e.target.value })}/></label></div>
      <p className="small">Se muestran observaciones del periodo exacto seleccionado. Los periodos superpuestos y porcentajes no se suman.</p>
      <div className="monitoring-table"><table><thead><tr><th>Variante / recurso</th><th>Métrica</th><th>Valor</th><th>Fuente</th><th>Notas</th>{editable && <th>Acciones</th>}</tr></thead><tbody>
        {rows.map(value => { const linked=data.resources.find(row => row.id===value.resource_id); const associated=data.variants.find(row => row.id===linked?.variant_id);
          return <tr key={value.id}><td>{associated?.label || "Sin variante"}<br/><span className="small">{linked?.label || linked?.external_id || "Recurso enlazado"}</span></td><td>{metricLabels[value.metric] || value.metric}</td>
            <td>{value.unit==="ratio" ? `${(Number(value.value)*100).toLocaleString("es",{maximumFractionDigits:2})} %` : `${Number(value.value).toLocaleString("es")}${value.currency ? ` ${value.currency}` : ""}`}</td>
            <td>{value.source==="csv" ? (value.notes.startsWith('Origen: Meta Insights API') ? 'Meta · importación revisada' : 'CSV importado') : value.source==="api" ? "API" : "Manual"}</td><td>{value.notes}</td>
            {editable && <td><button type="button" className="icon-button" aria-label={`Eliminar resultado ${value.metric}`} disabled={busy || value.source==="api"} onClick={() => {
              if (!window.confirm("¿Eliminar esta observación? La modificación quedará en el historial.")) return;
              void run(async () => { if (demo) setData(previous => previous && ({ ...previous,observations:previous.observations.filter(row => row.id!==value.id) })); else await remove("metric_observations",value.id); });
            }}><Trash2 size={14}/></button></td>}
          </tr>; })}
      </tbody></table>{!rows.length && <p className="small">No hay resultados para este periodo.</p>}</div>
      {editable && data.resources.length>0 && <>
        <form className="monitoring-form" onSubmit={e => { e.preventDefault(); void run(async () => {
          const payload={ ...scope, resource_id:metric.resource, metric:metric.key.trim(),unit:metric.unit,value:Number(metric.value),currency:metric.unit==="currency" ? metric.currency.toUpperCase() : null,period_start:metric.start,period_end:metric.end,notes:metric.notes,source:"manual" as const };
          validateObservation(payload);
          const existing=data.observations.find(value => value.resource_id===payload.resource_id && value.metric===payload.metric && value.period_start===payload.period_start && value.period_end===payload.period_end);
          if (demo) { const value={...payload,id:existing?.id || crypto.randomUUID(),updated_at:new Date().toISOString()}; setData(previous => previous && ({ ...previous,observations:existing ? previous.observations.map(row => row.id===existing.id ? value : row) : [...previous.observations,value] })); }
          else await write("metric_observations",payload,existing?.id,existing?.updated_at);
          setPeriod({start:metric.start,end:metric.end}); setMetric({ ...metric,value:"" });
        }); }}><fieldset disabled={busy} className="monitoring-grid">
          <label>Recurso<select required value={metric.resource} onChange={e => setMetric({ ...metric,resource:e.target.value })}><option value="">Seleccionar</option>{data.resources.map(value => <option key={value.id} value={value.id}>{value.label || value.external_id || value.external_url}</option>)}</select></label>
          <label>Métrica<input required pattern="[a-z][a-z0-9_]{0,63}" list="monitoring-metrics" value={metric.key} onChange={e => setMetric({ ...metric,key:e.target.value })}/><datalist id="monitoring-metrics">{Object.keys(metricLabels).map(key => <option key={key} value={key}/>)}</datalist></label>
          <label>Unidad<select value={metric.unit} onChange={e => setMetric({ ...metric,unit:e.target.value as Observation["unit"] })}>{Object.entries(unitLabels).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>Valor<input required type="number" min="0" step="any" value={metric.value} onChange={e => setMetric({ ...metric,value:e.target.value })}/></label>
          {metric.unit==="currency" && <label>Moneda<input required pattern="[A-Z]{3}" maxLength={3} value={metric.currency} onChange={e => setMetric({ ...metric,currency:e.target.value.toUpperCase() })}/></label>}
          <label>Desde<input required type="date" value={metric.start} onChange={e => setMetric({ ...metric,start:e.target.value })}/></label>
          <label>Hasta<input required type="date" value={metric.end} onChange={e => setMetric({ ...metric,end:e.target.value })}/></label>
          <label className="monitoring-wide">Fuente o nota de la medición<textarea maxLength={2000} value={metric.notes} onChange={e => setMetric({ ...metric,notes:e.target.value })}/></label>
          <button className="btn primary" type="submit">Guardar resultado</button>
        </fieldset></form>
        <p className="small">Guardar la misma métrica y periodo corrige el valor anterior y conserva la modificación en el historial.</p>
        <div className="monitoring-import">
          <button type="button" className="btn" onClick={() => { const url=URL.createObjectURL(new Blob([metricsCsvTemplate],{type:"text/csv;charset=utf-8"})); const link=document.createElement("a"); link.href=url; link.download="plantilla-resultados.csv"; link.click(); URL.revokeObjectURL(url); }}><Download size={14}/> Plantilla CSV</button>
          <label>Importar resultados<input type="file" accept=".csv,text/csv" disabled={busy} onChange={async e => {
            const file=e.target.files?.[0]; e.target.value=""; setCsv(null); setError("");
            if (!file) return;
            try { if (file.size>500000) throw new Error("El CSV debe ocupar menos de 500 KB."); const rows=parseMetricsCsv(await file.text()); csvObservationPayload(experiment,data.resources,rows); if (active.current) setCsv(rows); }
            catch (err) { if (active.current) setError(err instanceof Error ? err.message : "No se pudo leer el CSV."); }
          }}/></label>
          {csv && <div className="monitoring-wide"><p>{csv.length} filas listas. Coincidencias del mismo recurso, métrica y periodo actualizarán el valor anterior.</p>
            <div className="monitoring-table"><table><thead><tr><th>ID</th><th>Métrica</th><th>Valor</th><th>Periodo</th></tr></thead><tbody>{csv.slice(0,10).map((row,i) => <tr key={i}><td>{row.external_id}</td><td>{row.metric}</td><td>{row.value} {row.currency || row.unit}</td><td>{row.period_start} → {row.period_end}</td></tr>)}</tbody></table></div>
            <button className="btn primary" type="button" disabled={busy || !csv.length} onClick={() => void run(async () => {
              const payload=csvObservationPayload(experiment,data.resources,csv);
              if (demo) setData(previous => {
                if (!previous) return previous;
                const observations=[...previous.observations];
                for (const row of payload) { const index=observations.findIndex(value => value.resource_id===row.resource_id && value.metric===row.metric && value.period_start===row.period_start && value.period_end===row.period_end); const value={...row,id:index<0 ? crypto.randomUUID() : observations[index].id,updated_at:new Date().toISOString()}; if (index<0) observations.push(value); else observations[index]=value; }
                return {...previous,observations};
              });
              else { const result=await supabase!.from("metric_observations").upsert(payload,{onConflict:"resource_id,metric,period_start,period_end"}); if (result.error) throw new Error(result.error.message); }
              if (csv[0]) setPeriod({start:csv[0].period_start,end:csv[0].period_end}); setCsv(null);
            }, "CSV importado sin duplicar observaciones.")}>Confirmar importación</button>
          </div>}
        </div>
      </>}
      {!data.resources.length && <p className="notice">Vincula una campaña o recurso para guardar sus resultados.</p>}
    </details>
  </section>;
}

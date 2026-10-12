'use client';
import {useState} from 'react';
import type {Item} from '@/lib/model';
import {channels,emptyExecution,executionFromFields,executionSummary,parseChannel,type ExecutionPlan} from '@/lib/execution-plan';
import {emptyMeta,metaObjectives,metaPlacements,metaEvents} from '@/lib/meta-options';

export function ExperimentExecution({draft,disabled,onChange}:{draft:Item;disabled:boolean;onChange:(draft:Item)=>void}){
  let plan:ExecutionPlan=emptyExecution();
  try{if(draft.fields.execution_config){const value=JSON.parse(String(draft.fields.execution_config));if(value&&typeof value==='object'&&Array.isArray(value.variants))plan={...plan,...value};}}catch{}
  function update(value:ExecutionPlan){onChange({...draft,fields:{...draft.fields,execution_config:JSON.stringify(value)}});}
  return <section className="full monitoring-block" aria-label="Canal y configuración del experimento">
    <label>Canal principal<select disabled={disabled} value={String(draft.fields.channel||'')} onChange={e=>onChange({...draft,fields:{...draft.fields,channel:e.target.value}})}><option value="">Seleccionar canal…</option>{Object.entries(channels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <p className="small">Un canal principal, varias variantes y campañas. Puedes preparar el experimento antes de conectar la plataforma.</p>
    {draft.fields.channel && <details key={String(draft.fields.channel)} open><summary>Configuración de {channels[draft.fields.channel as keyof typeof channels]}</summary>
      {draft.fields.channel==='meta_ads'&&<fieldset className="monitoring-block monitoring-grid" disabled={disabled}><legend>Parámetros de Meta para revisión</legend><label>Enlace del anuncio<input type="text" maxLength={2000} value={plan.destination??''} onChange={e=>update({...plan,destination:e.target.value===''?null:e.target.value})}/></label>
<label>Inversión diaria total en Meta<input type="number" min="0" max="1000000" step="0.01" value={plan.daily_budget??''} onChange={e=>update({...plan,daily_budget:e.target.value===''?null:Number(e.target.value)})}/></label>
<label>Divisa de la cuenta publicitaria<input type="text" maxLength={3} value={plan.currency??''} onChange={e=>update({...plan,currency:e.target.value===''?null:e.target.value.toUpperCase()})}/></label>
<label>Días de campaña en Meta<input type="number" min="1" max="365" step="1" value={plan.duration_days??''} onChange={e=>update({...plan,duration_days:e.target.value===''?null:Number(e.target.value)})}/></label>
        <label>Objetivo en Meta<select value={plan.meta?.objective||''} onChange={e=>update({...plan,meta:{...(plan.meta||emptyMeta()),objective:e.target.value as NonNullable<ExecutionPlan['meta']>['objective']||null}})}><option value="">Pendiente</option>{Object.entries(metaObjectives).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Países (códigos separados por coma)<input value={plan.meta?.countries.join(',')||''} onChange={e=>update({...plan,meta:{...(plan.meta||emptyMeta()),countries:e.target.value.toUpperCase().split(',').map(v=>v.trim()).filter(Boolean)}})}/></label>
        <label>Edad mínima<input type="number" min={18} max={65} value={plan.meta?.age_min??''} onChange={e=>update({...plan,meta:{...(plan.meta||emptyMeta()),age_min:e.target.value?Number(e.target.value):null}})}/></label>
        <label>Edad máxima (65 incluye mayores)<input type="number" min={18} max={65} value={plan.meta?.age_max??''} onChange={e=>update({...plan,meta:{...(plan.meta||emptyMeta()),age_max:e.target.value?Number(e.target.value):null}})}/></label>
        <label>Evento para leads o ventas<select value={plan.meta?.conversion_event||''} onChange={e=>update({...plan,meta:{...(plan.meta||emptyMeta()),conversion_event:e.target.value as typeof metaEvents[number]||null}})}><option value="">Pendiente / no aplica</option>{metaEvents.map(v=><option key={v}>{v}</option>)}</select></label>
        <div>{Object.entries(metaPlacements).map(([key,label])=><label className="check" key={key}><input type="checkbox" checked={plan.meta?.placements.includes(key as keyof typeof metaPlacements)||false} onChange={e=>update({...plan,meta:{...(plan.meta||emptyMeta()),placements:e.target.checked?[...(plan.meta?.placements||[]),key as keyof typeof metaPlacements]:(plan.meta?.placements||[]).filter(p=>p!==key)}})}/>{label}</label>)}</div>
        <p className="small full">La ciudad se confirma mediante búsqueda en Meta al preparar. Los intereses y audiencias descritos en texto no se traducen automáticamente a segmentación: revisa el público real antes de crear. Leads y ventas necesitan un píxel configurado en Integraciones. Instalaciones, catálogos, formularios instantáneos y categorías especiales requieren preparación específica.</p>
      </fieldset>}
      {draft.fields.channel!=='meta_ads'&&<p className="small">{['web_app','mobile_ios','mobile_android'].includes(String(draft.fields.channel))?'Define las variantes de producto. El ID de PostHog se configura debajo para consultar resultados.':'Prepara las variantes y vincula el ID o enlace externo después de guardar. La creación automática mediante API todavía no está disponible para este canal.'}</p>}
      {plan.variants.map((variant,index)=><fieldset key={index} className="monitoring-block" disabled={disabled}><legend>Variante {index+1}</legend><div className="monitoring-grid">{(['label','description','headline','body','call_to_action'] as const).map(key=><label key={key}>{({label:'Nombre',description:'Qué cambia',headline:'Titular',body:'Texto',call_to_action:'Llamada a la acción'})[key]}<textarea maxLength={key==='label'?40:key==='call_to_action'?120:key==='headline'?300:4000} value={variant[key]||''} onChange={e=>update({...plan,variants:plan.variants.map((v,i)=>i===index?{...v,[key]:e.target.value||null}:v)})}/></label>)}<label>Reparto de tráfico (%)<input type="number" min={0} max={100} step="0.01" value={variant.allocation??''} onChange={e=>update({...plan,variants:plan.variants.map((v,i)=>i===index?{...v,allocation:e.target.value===''?null:Number(e.target.value)}:v)})}/></label></div><button type="button" className="btn" onClick={()=>update({...plan,variants:plan.variants.filter((_,i)=>i!==index)})}>Retirar variante del borrador</button></fieldset>)}
      <button type="button" className="btn" disabled={disabled||plan.variants.length>=6} onClick={()=>update({...plan,variants:[...plan.variants,{label:`Variante ${plan.variants.length+1}`,description:null,headline:null,body:null,call_to_action:null,allocation:null}]})}>Añadir variante al borrador</button>
      <p className="small">Puedes introducir un dominio sin https://: lo completamos con HTTPS al preparar o guardar. La IA rellena esta configuración para tu revisión. Guarda la ficha para conservarla. Todavía no crea ni publica recursos externos.</p>
    </details>}
  </section>;
}
export function ExecutionDetails({experiment}:{experiment:Item}){
  const [message,setMessage]=useState('');
  let plan:ExecutionPlan|null=null;let channel=null;
  try{plan=executionFromFields(experiment.fields);channel=parseChannel(experiment.fields.channel);}catch{return <p className="error">Revisa la configuración de ejecución en Editar ficha.</p>;}
  if(!channel&&!plan)return null;
  return <section className="monitoring-block"><h3>{channel?channels[channel]:'Canal pendiente'}</h3>{plan&&<><pre className="execution-summary">{executionSummary(channel,plan)}</pre><button type="button" className="btn" onClick={()=>void navigator.clipboard.writeText(executionSummary(channel,plan!)).then(()=>setMessage('Configuración copiada.'),()=>setMessage('No se pudo copiar. Selecciona el texto manualmente.'))}>Copiar configuración</button><p className="small">Configuración para revisión manual. Consulta los recursos vinculados y la conexión de la plataforma para comprobar su estado externo.</p>{message&&<p role="status">{message}</p>}</>}</section>;
}

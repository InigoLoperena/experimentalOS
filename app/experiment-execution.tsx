'use client';
import {useState} from 'react';
import type {Item} from '@/lib/model';
import {channels,goals,emptyExecution,executionFromFields,executionSummary,parseChannel,type ExecutionPlan} from '@/lib/execution-plan';

export function ExperimentExecution({draft,disabled,onChange}:{draft:Item;disabled:boolean;onChange:(draft:Item)=>void}){
  let plan:ExecutionPlan=emptyExecution();
  try{if(draft.fields.execution_config){const value=JSON.parse(String(draft.fields.execution_config));if(value&&typeof value==='object'&&Array.isArray(value.variants))plan={...plan,...value};}}catch{}
  function update(value:ExecutionPlan){onChange({...draft,fields:{...draft.fields,execution_config:JSON.stringify(value)}});}
  return <section className="full monitoring-block" aria-label="Canal y configuración del experimento">
    <label>Canal principal<select disabled={disabled} value={String(draft.fields.channel||'')} onChange={e=>onChange({...draft,fields:{...draft.fields,channel:e.target.value}})}><option value="">Seleccionar canal…</option>{Object.entries(channels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <p className="small">Un canal principal, varias variantes y campañas. Puedes preparar el experimento antes de conectar la plataforma.</p>
    <details><summary>Configuración y variantes para ejecutar</summary>
      <fieldset className="monitoring-grid" disabled={disabled}>
        <label>Objetivo de ejecución<select value={plan.goal||''} onChange={e=>update({...plan,goal:e.target.value as ExecutionPlan['goal']||null})}><option value="">Pendiente</option>{Object.entries(goals).map(([k,label])=><option key={k} value={k}>{label}</option>)}</select></label>
        <label>URL de destino<input type="url" placeholder="https://" maxLength={2000} value={plan.destination||''} onChange={e=>update({...plan,destination:e.target.value||null})}/></label>
        <label>Audiencia<textarea maxLength={4000} value={plan.audience||''} onChange={e=>update({...plan,audience:e.target.value||null})}/></label>
        <label>Ubicación<input maxLength={4000} placeholder="País, ciudad o zona" value={plan.location||''} onChange={e=>update({...plan,location:e.target.value||null})}/></label>
        <label>Presupuesto diario total<input type="number" min={0} max={1000000} step="0.01" value={plan.daily_budget??''} onChange={e=>update({...plan,daily_budget:e.target.value===''?null:Number(e.target.value)})}/></label>
        <label>Moneda<input maxLength={3} placeholder="USD" value={plan.currency||''} onChange={e=>update({...plan,currency:e.target.value.toUpperCase()||null})}/></label>
        <label>Duración en días<input type="number" min={1} max={365} value={plan.duration_days??''} onChange={e=>update({...plan,duration_days:e.target.value===''?null:Number(e.target.value)})}/></label>
      </fieldset>
      {plan.variants.map((variant,index)=><fieldset key={index} className="monitoring-block" disabled={disabled}><legend>Variante {index+1}</legend><div className="monitoring-grid">{(['label','description','headline','body','call_to_action'] as const).map(key=><label key={key}>{({label:'Nombre',description:'Qué cambia',headline:'Titular',body:'Texto',call_to_action:'Llamada a la acción'})[key]}<textarea maxLength={key==='label'||key==='call_to_action'?120:key==='headline'?300:4000} value={variant[key]||''} onChange={e=>update({...plan,variants:plan.variants.map((v,i)=>i===index?{...v,[key]:e.target.value||null}:v)})}/></label>)}<label>Reparto de tráfico (%)<input type="number" min={0} max={100} step="0.01" value={variant.allocation??''} onChange={e=>update({...plan,variants:plan.variants.map((v,i)=>i===index?{...v,allocation:e.target.value===''?null:Number(e.target.value)}:v)})}/></label></div><button type="button" className="btn" onClick={()=>update({...plan,variants:plan.variants.filter((_,i)=>i!==index)})}>Retirar variante del borrador</button></fieldset>)}
      <button type="button" className="btn" disabled={disabled||plan.variants.length>=6} onClick={()=>update({...plan,variants:[...plan.variants,{label:`Variante ${plan.variants.length+1}`,description:null,headline:null,body:null,call_to_action:null,allocation:null}]})}>Añadir variante al borrador</button>
      <p className="small">La IA rellena esta configuración para tu revisión. Guarda la ficha para conservarla. Todavía no crea ni publica recursos externos.</p>
    </details>
  </section>;
}
export function ExecutionDetails({experiment}:{experiment:Item}){
  const [message,setMessage]=useState('');
  let plan:ExecutionPlan|null=null;let channel=null;
  try{plan=executionFromFields(experiment.fields);channel=parseChannel(experiment.fields.channel);}catch{return <p className="error">Revisa la configuración de ejecución en Editar ficha.</p>;}
  if(!channel&&!plan)return null;
  return <section className="monitoring-block"><h3>{channel?channels[channel]:'Canal pendiente'}</h3>{plan&&<><pre className="execution-summary">{executionSummary(channel,plan)}</pre><button type="button" className="btn" onClick={()=>void navigator.clipboard.writeText(executionSummary(channel,plan!)).then(()=>setMessage('Configuración copiada.'),()=>setMessage('No se pudo copiar. Selecciona el texto manualmente.'))}>Copiar configuración</button><p className="small">Preparación para revisión manual. No se ha enviado ni publicado en la plataforma.</p>{message&&<p role="status">{message}</p>}</>}</section>;
}

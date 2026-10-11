'use client';
import { useRef,useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/lib/model';
import { applyPreparation,parsePreparation,type Preparation } from '@/lib/ai-preparation';
import { experimentFields } from '@/lib/experiments';

export function ExperimentAssistant({draft,disabled,demo,onApply,onBusy}: {draft:Item;disabled:boolean;demo:boolean;onApply:(draft:Item)=>void;onBusy:(value:boolean)=>void}) {
  const [prompt,setPrompt]=useState('');
  const [busy,setBusy]=useState(false);
  const [proposal,setProposal]=useState<Preparation | null>(null);
  const [error,setError]=useState('');
  const [usage,setUsage]=useState<number | null>(null);
  const pending=useRef(false);
  async function prepare() {
    if (pending.current || disabled || !prompt.trim() || demo) return;
    pending.current=true; setBusy(true); onBusy(true); setError(''); setProposal(null);
    try {
      const session=await supabase!.auth.getSession();
      if (!session.data.session) throw new Error('Inicia sesión para utilizar el asistente.');
      const response=await fetch('/api/ai/prepare',{method:'POST',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},
        body:JSON.stringify({project_id:draft.project_id,request_id:crypto.randomUUID(),prompt,fields:draft.fields})});
      const value=await response.json();
      if (!response.ok) throw new Error(value.error || 'No se pudo preparar la propuesta.');
      setProposal(parsePreparation(value.proposal)); setUsage(value.reserved_usd);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo conectar con el asistente.'); }
    finally { pending.current=false;setBusy(false);onBusy(false); }
  }
  return <details className="monitoring-block full"><summary>Preparar con IA</summary>
    <p className="small">Utiliza el contexto y los aprendizajes registrados del proyecto. La propuesta necesita revisión. En esta primera versión describe los materiales en el texto; sus archivos no se envían a la IA.</p>
    {demo ? <p className="notice">El asistente está disponible al iniciar sesión en tu workspace.</p> : <>
      <label>Describe el experimento<textarea maxLength={4000} rows={4} disabled={disabled || busy} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Prepara un A/B en Meta Ads para Greenhunt: muebles gratuitos frente a sostenibilidad, en Nueva York, siete días y 10 USD diarios…"/></label>
      <button className="btn primary" type="button" disabled={disabled || busy || !prompt.trim()} onClick={() => void prepare()}>{busy ? 'Preparando propuesta…' : 'Proponer contenido'}</button>
      <p className="small">Límite de IA: 5 USD al mes por workspace. Cada solicitud reserva 0,03 USD de ese límite, incluso si falla; es una estimación conservadora, no la factura de OpenAI.{usage!==null && ` Reservado este mes: ${usage.toFixed(2)} USD.`}</p>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    {proposal && <div className="assistant-proposal"><h3>{proposal.title}</h3>
      {Object.entries(proposal.fields).filter(([,value]) => value!==null).map(([key,value]) => <p key={key}><strong>{experimentFields.find(field => field.key===key)?.label || key}</strong><br/>{value}</p>)}
      {!!proposal.missing.length && <><h4>Falta confirmar</h4><ul>{proposal.missing.map((value,index) => <li key={index}>{experimentFields.find(field => field.key===value)?.label || value}</li>)}</ul></>}
      {!!proposal.assumptions.length && <><h4>Supuestos de la IA</h4><ul>{proposal.assumptions.map((value,index) => <li key={index}>{value}</li>)}</ul></>}
      <button type="button" className="btn primary" disabled={disabled || busy} onClick={() => { onApply({...draft,title:proposal.title,fields:applyPreparation(draft.fields,proposal)});setProposal(null); }}>Rellenar formulario para revisar</button>
      <p className="small">Los datos no se guardan hasta pulsar «Guardar ficha». La IA no modifica el responsable, las relaciones ni los IDs.</p>
    </div>}
  </details>;
}

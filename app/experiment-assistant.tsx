'use client';
import { useRef,useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/lib/model';
import { applyPreparation,parsePreparation,type Preparation } from '@/lib/ai-preparation';
import { experimentFields } from '@/lib/experiments';
import {channels,executionSummary} from '@/lib/execution-plan';
import {AIPromptComposer} from './ai-prompt-composer';
import {preparePromptFiles} from '@/lib/ai-prompt-files';

export function ExperimentAssistant({draft,files,onFiles,disabled,demo,onApply,onBusy,allowAttachments=true}: {draft:Item;files:File[];onFiles:(files:File[])=>void;disabled:boolean;demo:boolean;onApply:(draft:Item)=>void;onBusy:(value:boolean)=>void;allowAttachments?:boolean}) {
  const [prompt,setPrompt]=useState('');
  const [busy,setBusy]=useState(false);
  const [proposal,setProposal]=useState<Preparation | null>(null);
  const [error,setError]=useState('');
  const [usage,setUsage]=useState<number | null>(null);
  const [answers,setAnswers]=useState('');
  const [voiceBusy,setVoiceBusy]=useState(false);
  const conversation=useRef('');
  const pending=useRef(false);
  async function prepare() {
    if (pending.current || voiceBusy || disabled || (!prompt.trim()&&!files.length) || demo) return;
    const previous=proposal;
    const followup=previous&&answers.trim()?`\nPreguntas anteriores: ${(previous.questions||previous.missing).join(' ')}\nRespuestas del usuario: ${answers.trim()}`:'';
    const fullPrompt=(prompt.trim()||'Analiza los materiales adjuntos y prepara una propuesta de experimento.')+conversation.current+followup;
    if(fullPrompt.length>4000){setError('Acorta la descripción o las respuestas; la conversación admite hasta 4.000 caracteres.');return;}
    pending.current=true; setBusy(true); onBusy(true); setError('');
    try {
      const session=await supabase!.auth.getSession();
      if (!session.data.session) throw new Error('Inicia sesión para utilizar el asistente.');
      const {media,documents}=await preparePromptFiles(files,'experiment');
      const response=await fetch('/api/ai/prepare',{method:'POST',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},
        body:JSON.stringify({project_id:draft.project_id,request_id:crypto.randomUUID(),prompt:fullPrompt,fields:previous?applyPreparation(draft.fields,previous):draft.fields,media,documents})});
      const value=await response.json();
      if (!response.ok) throw new Error(value.error || 'No se pudo preparar la propuesta.');
      setProposal(parsePreparation(value.proposal)); setUsage(value.reserved_usd);conversation.current+=followup;setAnswers('');
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo conectar con el asistente.'); }
    finally { pending.current=false;setBusy(false);onBusy(false); }
  }
  function promptChanged(value:string){setPrompt(value);setProposal(null);conversation.current='';setAnswers('');}
  function voiceActivity(value:boolean){setVoiceBusy(value);onBusy(value);}
  return <details key={String(draft.fields.channel)} open={['meta_ads','google_ads','smartlead'].includes(String(draft.fields.channel))?true:undefined} className="monitoring-block full"><summary>Preparar con IA</summary>
    <p className="small">Utiliza el canal seleccionado y el contexto real del proyecto. Propone la ficha, configuración y variantes para revisión. Define tú el criterio de éxito.</p>
    {demo ? <p className="notice">El asistente está disponible al iniciar sesión en tu workspace.</p> : <>
      <AIPromptComposer id="experiment-ai-prompt" projectId={draft.project_id} purpose="experiment" value={prompt} onChange={promptChanged} maxLength={4000} files={files} onFiles={next=>{onFiles(next);setProposal(null);setError('');}} allowFiles={allowAttachments} disabled={disabled||busy} voiceBusy={voiceBusy} onVoiceBusy={voiceActivity} busy={busy} placeholder="Describe el experimento o adjunta archivos…" onSubmit={()=>void prepare()}/>
      {!allowAttachments&&<p className="small">Para guardar archivos necesitas permiso para editar experimentos.</p>}
      <p className="small">Al enviar se analizan los documentos y materiales seleccionados; de cada vídeo se extraen cuatro fotogramas, sin audio. Los archivos originales se guardan al guardar la ficha.</p>
      {busy&&<p role="status" className="small">Preparando propuesta…</p>}
      <p className="small">Límite de IA: 5 USD al mes por workspace. Cada solicitud reserva 0,03 USD de ese límite, incluso si falla; es una estimación conservadora, no la factura de OpenAI.{usage!==null && ` Reservado este mes: ${usage.toFixed(2)} USD.`}</p>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    {proposal && <div className="assistant-proposal"><h3>{proposal.title}</h3>
      {proposal.channel&&<p><strong>Canal principal</strong><br/>{channels[proposal.channel]}</p>}
      {proposal.execution&&!['meta_ads','google_ads'].includes(String(draft.fields.channel))&&<pre className="execution-summary">{executionSummary(proposal.channel||null,proposal.execution)}</pre>}
      {Object.entries(proposal.fields).filter(([,value]) => value!==null).map(([key,value]) => <p key={key}><strong>{experimentFields.find(field => field.key===key)?.label || key}</strong><br/>{value}</p>)}
      {!!proposal.missing.length && <><h4>Falta confirmar</h4><ul>{proposal.missing.map((value,index) => <li key={index}>{experimentFields.find(field => field.key===value)?.label || value}</li>)}</ul></>}
      {!!proposal.assumptions.length && <><h4>Supuestos de la IA</h4><ul>{proposal.assumptions.map((value,index) => <li key={index}>{value}</li>)}</ul></>}
      {!!proposal.recommendations?.length&&<><h4>Recomendaciones para revisar</h4><ul>{proposal.recommendations.map((value,index)=><li key={index}>{value}</li>)}</ul></>}
      {!!proposal.questions?.length&&<><h4>La IA necesita tus respuestas</h4><ol>{proposal.questions.map((value,index)=><li key={index}>{value}</li>)}</ol><AIPromptComposer id="experiment-ai-followup" projectId={draft.project_id} purpose="experiment" value={answers} onChange={setAnswers} maxLength={2000} files={files} onFiles={onFiles} allowFiles={allowAttachments} disabled={disabled||busy} voiceBusy={voiceBusy} onVoiceBusy={voiceActivity} busy={busy} placeholder="Responde a la IA…" onSubmit={()=>void prepare()}/></>}
      <button type="button" className="btn primary" disabled={disabled || busy || voiceBusy} onClick={() => { onApply({...draft,title:proposal.title,fields:applyPreparation(draft.fields,proposal)});setProposal(null); }}>Rellenar formulario para revisar</button>
      <p className="small">Rellena el formulario para revisar y después guarda la ficha.{draft.fields.channel==='meta_ads'&&' Usa «Guardar y revisar envío a Meta» para pasar a la revisión de campaña y creatividades antes de enviarlas.'}{draft.fields.channel==='google_ads'&&' Pulsa «Enviar a Google Ads» para guardar la ficha y crear la campaña pausada. Su configuración se revisa en Google Ads.'} La IA no modifica el responsable, las relaciones ni los IDs.</p>
    </div>}
  </details>;
}

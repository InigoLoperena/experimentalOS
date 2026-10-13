'use client';
import { useRef,useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/lib/model';
import { applyPreparation,parsePreparation,type Preparation } from '@/lib/ai-preparation';
import { experimentFields } from '@/lib/experiments';
import {attachmentFileType} from '@/lib/attachments';
import {channels,executionSummary} from '@/lib/execution-plan';

export function ExperimentAssistant({draft,files,onFiles,disabled,demo,onApply,onBusy,allowAttachments=true}: {draft:Item;files:File[];onFiles:(files:File[])=>void;disabled:boolean;demo:boolean;onApply:(draft:Item)=>void;onBusy:(value:boolean)=>void;allowAttachments?:boolean}) {
  const [prompt,setPrompt]=useState('');
  const [busy,setBusy]=useState(false);
  const [proposal,setProposal]=useState<Preparation | null>(null);
  const [error,setError]=useState('');
  const [usage,setUsage]=useState<number | null>(null);
  const [answers,setAnswers]=useState('');
  const conversation=useRef('');
  const pending=useRef(false);
  async function prepare() {
    if (pending.current || disabled || !prompt.trim() || demo) return;
    const previous=proposal;
    const followup=previous&&answers.trim()?`\nPreguntas anteriores: ${(previous.questions||previous.missing).join(' ')}\nRespuestas del usuario: ${answers.trim()}`:'';
    const fullPrompt=prompt+conversation.current+followup;
    if(fullPrompt.length>4000){setError('Acorta la descripción o las respuestas; la conversación admite hasta 4.000 caracteres.');return;}
    pending.current=true; setBusy(true); onBusy(true); setError('');
    try {
      const session=await supabase!.auth.getSession();
      if (!session.data.session) throw new Error('Inicia sesión para utilizar el asistente.');
      const {prepareMedia}=await import('@/lib/prepare-media');
      const media=await prepareMedia(files);
      const response=await fetch('/api/ai/prepare',{method:'POST',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},
        body:JSON.stringify({project_id:draft.project_id,request_id:crypto.randomUUID(),prompt:fullPrompt,fields:previous?applyPreparation(draft.fields,previous):draft.fields,media})});
      const value=await response.json();
      if (!response.ok) throw new Error(value.error || 'No se pudo preparar la propuesta.');
      setProposal(parsePreparation(value.proposal)); setUsage(value.reserved_usd);conversation.current+=followup;setAnswers('');
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo conectar con el asistente.'); }
    finally { pending.current=false;setBusy(false);onBusy(false); }
  }
  return <details key={String(draft.fields.channel)} open={draft.fields.channel==='meta_ads'?true:undefined} className="monitoring-block full"><summary>Preparar con IA</summary>
    <p className="small">Utiliza el canal seleccionado y el contexto real del proyecto. Propone la ficha, configuración y variantes para revisión. Define tú el criterio de éxito.</p>
    {demo ? <p className="notice">El asistente está disponible al iniciar sesión en tu workspace.</p> : <>
      <label>Describe el experimento<textarea maxLength={4000} rows={4} disabled={disabled || busy} value={prompt} onChange={e => {setPrompt(e.target.value);setProposal(null);conversation.current='';setAnswers('');}} placeholder="Prepara un A/B en Meta Ads para Greenhunt: muebles gratuitos frente a sostenibilidad, en Nueva York, siete días y 10 USD diarios…"/></label>
      <label>Materiales del experimento<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm" disabled={disabled||busy||!allowAttachments} onChange={e=>{try{const selected=Array.from(e.target.files||[]);selected.forEach(attachmentFileType);if(selected.length>4)throw new Error('Selecciona hasta cuatro materiales.');if(selected.filter(f=>attachmentFileType(f).kind==='video').length*4+selected.filter(f=>attachmentFileType(f).kind==='image').length>8)throw new Error('Selecciona hasta ocho imágenes o fotogramas (cada vídeo utiliza cuatro).');onFiles(selected);setError('');setProposal(null);}catch(error){setError(error instanceof Error?error.message:'Revisa los materiales.');}e.target.value='';}}/></label>
      {!allowAttachments&&<p className="small">Para guardar materiales necesitas permiso para editar experimentos. Puedes preparar y crear una ficha de texto con tu permiso de creación.</p>}
      {files.length>0&&<><ul>{files.map((file,index)=><li key={index}>{file.name}</li>)}</ul><button type="button" className="btn" disabled={busy||disabled} onClick={()=>onFiles([])}>Retirar materiales del formulario</button></>}
      <p className="small">Al proponer contenido se envían a OpenAI las imágenes y cuatro fotogramas por vídeo; no se analiza el audio ni todo el vídeo. Vídeos de hasta tres minutos, archivos de hasta 10 MB. Los originales se guardan como adjuntos privados al guardar la ficha.</p>
      <button className="btn primary" type="button" disabled={disabled || busy || !prompt.trim()} onClick={() => void prepare()}>{busy ? 'Preparando propuesta…' : 'Proponer contenido'}</button>
      <p className="small">Límite de IA: 5 USD al mes por workspace. Cada solicitud reserva 0,03 USD de ese límite, incluso si falla; es una estimación conservadora, no la factura de OpenAI.{usage!==null && ` Reservado este mes: ${usage.toFixed(2)} USD.`}</p>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    {proposal && <div className="assistant-proposal"><h3>{proposal.title}</h3>
      {proposal.channel&&<p><strong>Canal principal</strong><br/>{channels[proposal.channel]}</p>}
      {proposal.execution&&<pre className="execution-summary">{executionSummary(proposal.channel||null,proposal.execution)}</pre>}
      {Object.entries(proposal.fields).filter(([,value]) => value!==null).map(([key,value]) => <p key={key}><strong>{experimentFields.find(field => field.key===key)?.label || key}</strong><br/>{value}</p>)}
      {!!proposal.missing.length && <><h4>Falta confirmar</h4><ul>{proposal.missing.map((value,index) => <li key={index}>{experimentFields.find(field => field.key===value)?.label || value}</li>)}</ul></>}
      {!!proposal.assumptions.length && <><h4>Supuestos de la IA</h4><ul>{proposal.assumptions.map((value,index) => <li key={index}>{value}</li>)}</ul></>}
      {!!proposal.recommendations?.length&&<><h4>Recomendaciones para revisar</h4><ul>{proposal.recommendations.map((value,index)=><li key={index}>{value}</li>)}</ul></>}
      {!!proposal.questions?.length&&<><h4>La IA necesita tus respuestas</h4><ol>{proposal.questions.map((value,index)=><li key={index}>{value}</li>)}</ol><label>Responde para mejorar la propuesta<textarea value={answers} maxLength={2000} disabled={busy||disabled} onChange={e=>setAnswers(e.target.value)}/></label><button type="button" className="btn" disabled={busy||disabled||!answers.trim()} onClick={()=>void prepare()}>Actualizar propuesta con mis respuestas</button></>}
      <button type="button" className="btn primary" disabled={disabled || busy} onClick={() => { onApply({...draft,title:proposal.title,fields:applyPreparation(draft.fields,proposal)});setProposal(null); }}>Rellenar formulario para revisar</button>
      <p className="small">Rellena el formulario para revisar y después guarda la ficha.{draft.fields.channel==='meta_ads'&&' Usa «Guardar y revisar envío a Meta» para pasar a la revisión de campaña y creatividades antes de enviarlas.'} La IA no modifica el responsable, las relaciones ni los IDs.</p>
    </div>}
  </details>;
}

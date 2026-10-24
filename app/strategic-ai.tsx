'use client';
import {useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import {FileUp,FlaskConical} from 'lucide-react';
import {AIBrainIcon} from './ai-brain-icon';
import {MethodologyLibrary} from './methodology-library';
import {supabase} from '@/lib/supabase';
import {parseKnowledge,type ChatEntry,type Knowledge} from '@/lib/ai-memory';
import type {Preparation} from '@/lib/ai-preparation';
import type {Item} from '@/lib/model';
import {AIPromptComposer} from './ai-prompt-composer';
import {preparePromptFiles} from '@/lib/ai-prompt-files';
import {saveWorkspaceFile,indexWorkspaceDocument,type WorkspaceDocument} from '@/lib/workspace-documents';
type Props={workspace:{id:string;name?:string};project:Item|null;disabled:boolean;canImport:boolean;canEdit:boolean;canDelete:boolean;canCreate:boolean;onProposal:(proposal:Preparation)=>void};
export function StrategicAI({workspace,project,disabled,canImport,canEdit,canDelete,canCreate,onProposal}:Props){
 const [entries,setEntries]=useState<ChatEntry[]>([]),[knowledge,setKnowledge]=useState<Knowledge[]>([]),[documents,setDocuments]=useState<WorkspaceDocument[]>([]);
 const [question,setQuestion]=useState(''),[files,setFiles]=useState<File[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [title,setTitle]=useState(''),[content,setContent]=useState(''),[format,setFormat]=useState<Knowledge['format']>('text'),[source,setSource]=useState(''),[validation,setValidation]=useState<Knowledge['validation']>('unverified');
 const [category,setCategory]=useState<NonNullable<Knowledge['category']>>('note'),[evidence,setEvidence]=useState(''),[importing,setImporting]=useState(false),[showImport,setShowImport]=useState(false),[showTextImport,setShowTextImport]=useState(false),[showArchived,setShowArchived]=useState(false);
 const [viewedSource,setViewedSource]=useState<Knowledge|null>(null),[reviewValidation,setReviewValidation]=useState<Knowledge['validation']>('unverified'),[reviewEvidence,setReviewEvidence]=useState(''),[voiceBusy,setVoiceBusy]=useState(false);
 const version=useRef(0),controller=useRef<AbortController|null>(null),fileIds=useRef(new WeakMap<File,string>()),end=useRef<HTMLDivElement>(null);
 async function loadLibrary(){
  const current=version.current;
  const [docs,originals]=await Promise.all([
   supabase!.from('ai_knowledge').select('id,workspace_id,project_id,title,format,source,validation,category,evidence,created_at,updated_at,archived_at').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).order('id').limit(100),
   supabase!.from('ai_documents').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).order('id').limit(100),
  ]);
  if(docs.error||originals.error)throw new Error('No se pudo cargar la biblioteca compartida.');
  if(current===version.current){setKnowledge((docs.data||[]) as Knowledge[]);setDocuments((originals.data||[]) as WorkspaceDocument[]);}
 }
 useEffect(()=>{
  const current=++version.current;setEntries([]);setKnowledge([]);setDocuments([]);setFiles([]);setQuestion('');setError('');setNotice('');setLoading(true);
  if(disabled||!supabase){setLoading(false);return;}
  void(async()=>{try{
   const {data}=await supabase!.auth.getSession();if(!data.session)throw new Error('Inicia sesión para consultar la memoria del equipo.');
   await loadLibrary();
  }catch(err){if(current===version.current)setError(message(err));}finally{if(current===version.current)setLoading(false);}})();
  return()=>{version.current++;controller.current?.abort();};
 },[workspace.id,disabled]);
 useEffect(()=>{if(entries.length||busy)end.current?.scrollIntoView({block:'nearest',behavior:'instant'});},[entries,busy]);
 async function preserve(selected:File[]){
  for(const file of selected){let id=fileIds.current.get(file);if(!id){id=crypto.randomUUID();fileIds.current.set(file,id);}await saveWorkspaceFile(workspace.id,null,file,id);}await loadLibrary();
 }
 async function send(){
  if(busy||voiceBusy||(!question.trim()&&!files.length)||disabled||!supabase)return;
  const current=version.current,abort=new AbortController();controller.current=abort;setBusy(true);setError('');setNotice('');
  try{
   const attachments=await preparePromptFiles(files,'chat');
   const {data}=await supabase.auth.getSession();if(!data.session)throw new Error('Inicia sesión de nuevo.');
   const response=await fetch('/api/ai/chat',{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({workspace_id:workspace.id,project_id:project?.id||null,question:question.trim()||'Analiza los archivos adjuntos para el equipo.',...attachments,request_id:crypto.randomUUID()})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo consultar la IA.');if(current===version.current){setEntries(rows=>[...rows,result.entry]);setQuestion('');setFiles([]);}
  }catch(err){if(current===version.current&&!abort.signal.aborted)setError(message(err));}finally{if(current===version.current)setBusy(false);}
 }
 async function importMemory(){
  if(!supabase||!canImport||importing)return;setError('');setImporting(true);
  try{
   const parsed=parseKnowledge(title,content,format,source,validation);
   const saved=await supabase.from('ai_knowledge').insert({...parsed,workspace_id:workspace.id,project_id:null,category,evidence});
   if(saved.error)throw new Error('No se pudo guardar el conocimiento. Comprueba tus permisos.');await loadLibrary();setTitle('');setContent('');setSource('');setEvidence('');setCategory('note');setFormat('text');setValidation('unverified');setShowImport(false);setShowTextImport(false);setNotice('Información importada.');
  }catch(err){setError(message(err));}finally{setImporting(false);}
 }
 async function uploadLibrary(file:File){if(!canImport||locked)return;setImporting(true);setError('');try{await preserve([file]);setNotice('Archivo importado.');}catch(err){setError(message(err));}finally{setImporting(false);}}
 async function viewSource(id:string){const result=await supabase!.from('ai_knowledge').select('*').eq('id',id).eq('workspace_id',workspace.id).single();if(result.error){setError('La fuente ya no está disponible.');return;}setViewedSource(result.data as Knowledge);setReviewValidation(result.data.validation);setReviewEvidence(result.data.evidence||'');}
 async function review(){
  if(!viewedSource||!canEdit)return;setImporting(true);setError('');try{const saved=await supabase!.from('ai_knowledge').update({validation:reviewValidation,evidence:reviewEvidence}).eq('id',viewedSource.id).eq('workspace_id',workspace.id).eq('updated_at',viewedSource.updated_at!).select('id');if(saved.error||!saved.data?.length)throw new Error('La fuente cambió o no tienes permiso. Ábrela de nuevo.');setViewedSource(null);await loadLibrary();setNotice('Revisión guardada. Revisar una fuente no demuestra causalidad.');}catch(err){setError(message(err));}finally{setImporting(false);}
 }
 async function archive(row:Knowledge){if(!canEdit||!canDelete||importing)return;setImporting(true);setError('');try{const result=await supabase!.from('ai_knowledge').update({archived_at:row.archived_at?null:new Date().toISOString()}).eq('id',row.id).eq('workspace_id',workspace.id).eq('updated_at',row.updated_at!).select('id');if(result.error||!result.data?.length)throw new Error('La fuente cambió o no tienes permiso. Actualiza la biblioteca.');await loadLibrary();}catch(err){setError(message(err));}finally{setImporting(false);}}
 function saveAnswer(entry:ChatEntry){setTitle('Aprendizaje propuesto · '+new Date(entry.created_at).toLocaleDateString('es'));setContent(entry.answer);setCategory('learning');setFormat('text');setValidation('unverified');setSource('Propuesta de IA, pendiente de revisión humana');setEvidence(entry.sources.map(s=>`${s.project_name||'Equipo'} · ${s.title} · ${s.date}\n${s.excerpt}`).join('\n\n').slice(0,10000));setShowImport(true);setShowTextImport(true);}
 async function openOriginal(doc:WorkspaceDocument){const result=await supabase!.storage.from('ai-documents').createSignedUrl(doc.storage_path,300);if(result.error){setError('No se pudo abrir el original privado.');return;}window.open(result.data.signedUrl,'_blank','noopener,noreferrer');}
 const locked=busy||voiceBusy||importing||disabled;
 const validationOptions=<><option value="unverified">Pendiente de revisión</option><option value="reviewed">Revisado por una persona</option><option value="contradicted">Cuestionado por nueva evidencia</option></>;
 return <section className="strategic-ai">
  {disabled&&<p className="notice">Inicia sesión en tu equipo para utilizar su IA privada.</p>}
  <MethodologyLibrary/>
  <div className="panel ai-chat">
   <div className="ai-intro-header">
    <div className="ai-intro-copy">
     <h2 className="ai-section-title"><AIBrainIcon size={28}/> IA / {workspace.name||'Mi espacio de trabajo'}</h2>
     <p className="ai-chat-intro">Una IA que aprende de todos tus experimentos, hipótesis y aprendizajes y utiliza la metodología Growth Tree para enfocar el crecimiento en la estrategia. Importa información y contexto relevante de tus proyectos, cualitativo o cuantitativo, en archivos CSV, PDF, DOCX o TXT para hacerla más inteligente.</p>
     <a className="ai-research-guide-link" href="/guia-investigacion" target="_blank" rel="noopener noreferrer">Consejos para investigar mercados, problemas, soluciones e importar información útil</a>
    </div>
    <Image className="ai-project-mascot" src="/einstein-project-ia-hd.png" width={1254} height={1254} sizes="(max-width: 800px) 150px, 190px" quality={85} alt="Einstein con una bombilla y una probeta"/>
   </div>
   <button className="btn ai-import-toggle" disabled={locked||loading} aria-expanded={showImport} aria-controls="workspace-ai-import" onClick={()=>setShowImport(v=>!v)}>
    <FileUp size={17}/>{showImport?'Cerrar importación':canImport?'Importar información':'Ver información importada'}
   </button>
   {showImport&&<section id="workspace-ai-import" className="ai-library-panel" aria-label="Información del espacio de trabajo">
    {canImport&&<div className="ai-import">
     <label>Subir un archivo (hasta 10 MB)<input type="file" accept=".txt,.csv,.json,.md,.pdf,.docx,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm" disabled={locked} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void uploadLibrary(file);}}/></label>
     <details className="ai-text-import" open={showTextImport} onToggle={e=>setShowTextImport(e.currentTarget.open)}>
      <summary>Añadir texto</summary>
      <div className="ai-import">
       <label>Título<input maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label>
       <label>Formato<select value={format} onChange={e=>setFormat(e.target.value as typeof format)}><option value="text">Texto</option><option value="csv">CSV</option><option value="json">JSON</option></select></label>
       <label>Contenido<textarea rows={6} maxLength={100000} value={content} onChange={e=>setContent(e.target.value)}/></label>
       <label>Fuente (opcional)<input value={source} maxLength={2000} onChange={e=>setSource(e.target.value)}/></label>
       <button className="btn primary" disabled={locked||!title.trim()||!content.trim()} onClick={()=>void importMemory()}>Importar al espacio de trabajo</button>
      </div>
     </details>
    </div>}
    {viewedSource&&<div className="ai-source-preview">
     <strong>{viewedSource.title}</strong><pre>{viewedSource.content}</pre>
     <label>Estado<select disabled={!canEdit||locked} value={reviewValidation} onChange={e=>setReviewValidation(e.target.value as typeof reviewValidation)}>{validationOptions}</select></label>
     <label>Evidencia<textarea disabled={!canEdit||locked} value={reviewEvidence} maxLength={10000} onChange={e=>setReviewEvidence(e.target.value)}/></label>
     {canEdit&&<button className="btn" disabled={locked} onClick={()=>void review()}>Guardar revisión</button>}
     <button className="btn" onClick={()=>setViewedSource(null)}>Cerrar</button>
    </div>}
    {knowledge.some(row=>row.archived_at)&&<label className="ai-reviewed"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>Mostrar archivadas</label>}
    <div className="ai-knowledge-list">{knowledge.filter(row=>!!row.archived_at===showArchived).map(row=><article key={row.id}>
     <button className="btn" onClick={()=>void viewSource(row.id)}>{row.title}</button>
     <small>{statusLabel(row.validation)}</small>
     {canEdit&&canDelete&&<button className="btn" disabled={locked} onClick={()=>void archive(row)}>{row.archived_at?'Restaurar':'Archivar'}</button>}
    </article>)}</div>
    {documents.length>0&&<div className="ai-imported-files"><h3>Archivos importados</h3>{documents.map(doc=><article className="ai-source" key={doc.id}>
     <button className="btn" onClick={()=>void openOriginal(doc)}>{doc.name}</button>
     <small>{doc.extraction_status==='ready'?'Disponible para la IA':doc.extraction_status==='needs_review'?'Añade una transcripción para que la IA pueda consultar su contenido':'Preparando archivo'}</small>
     {canImport&&['pending','failed'].includes(doc.extraction_status)&&<button className="btn" disabled={locked} onClick={()=>{setImporting(true);void indexWorkspaceDocument(workspace.id,doc.id).then(()=>loadLibrary()).catch(err=>setError(message(err))).finally(()=>setImporting(false));}}>Reintentar</button>}
    </article>)}</div>}
   </section>}
   <div className="ai-messages" role="log" aria-label="Conversación con IA">{entries.map(entry=><article key={entry.id} className="ai-exchange">
    <div className="ai-question"><p>{entry.question}</p></div>
    <div className="ai-answer"><p>{entry.answer}</p>
     {entry.coverage.warning&&<p className="notice">{entry.coverage.warning}</p>}
     {canImport&&<button className="btn ai-save-learning" disabled={locked} onClick={()=>saveAnswer(entry)}>Guardar aprendizaje</button>}
     {entry.proposal&&<div className="ai-proposal">
      <strong><FlaskConical size={17}/> {entry.proposal.title}</strong><p>{entry.proposal.fields.hypothesis}</p>
      <button className="btn primary" disabled={!canCreate||!project||entry.project_id!==project.id||locked} onClick={()=>{if(entry.project_id===project?.id)onProposal(entry.proposal!);}}>Revisar y crear experimento</button>
     </div>}
    </div>
   </article>)}{busy&&<p role="status">Pensando…</p>}<div ref={end}/></div>
   <AIPromptComposer id="strategic-question" workspaceId={workspace.id} projectId={project?.id||null} purpose="chat" value={question} onChange={setQuestion} maxLength={6000} files={files} onFiles={setFiles} disabled={disabled||busy||loading||importing} voiceBusy={voiceBusy} onVoiceBusy={setVoiceBusy} busy={busy} placeholder="Escribe tu mensaje…" onSubmit={()=>void send()}/>
  </div>
  {notice&&<p className="notice" role="status">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}
 </section>;
}

function message(err:unknown){return err instanceof Error?err.message:'No se pudo completar la operación.';}
function statusLabel(value?:string){return value==='reviewed'?'Revisado por una persona':value==='contradicted'?'Cuestionado':value==='observed'?'Medición guardada':'Sin verificar';}

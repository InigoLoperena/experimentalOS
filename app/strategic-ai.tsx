'use client';
import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,Database,FileUp,FlaskConical,Sparkles,Trash2,ExternalLink} from 'lucide-react';
import {AIBrainIcon} from './ai-brain-icon';
import {supabase} from '@/lib/supabase';
import {parseKnowledge,type ChatEntry,type Knowledge} from '@/lib/ai-memory';
import type {Preparation} from '@/lib/ai-preparation';
import type {Item} from '@/lib/model';
import {AIPromptComposer} from './ai-prompt-composer';
import {preparePromptFiles} from '@/lib/ai-prompt-files';

export function StrategicAI({project,disabled,canImport,canDelete,canCreate,onProposal,onSource}:{project:Item|null;disabled:boolean;canImport:boolean;canDelete:boolean;canCreate:boolean;onProposal:(proposal:Preparation)=>void;onSource:(id:string)=>void}){
 const [entries,setEntries]=useState<ChatEntry[]>([]),[knowledge,setKnowledge]=useState<Knowledge[]>([]);
 const [question,setQuestion]=useState(''),[files,setFiles]=useState<File[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [title,setTitle]=useState(''),[content,setContent]=useState(''),[format,setFormat]=useState<Knowledge['format']>('text'),[source,setSource]=useState(''),[reviewed,setReviewed]=useState(false),[importing,setImporting]=useState(false);
 const [showImport,setShowImport]=useState(false);
 const [viewedSource,setViewedSource]=useState<Knowledge|null>(null);
 const [voiceBusy,setVoiceBusy]=useState(false);
 const end=useRef<HTMLDivElement>(null),version=useRef(0),controller=useRef<AbortController|null>(null);
 const projectId=project?.id;
 useEffect(()=>{
  const current=++version.current;setEntries([]);setKnowledge([]);setFiles([]);setError('');setQuestion('');setLoading(true);
  if(disabled||!projectId||!supabase){setLoading(false);return;}
  const client=supabase;
  void (async()=>{try{
   const {data:session}=await client.auth.getSession();
   if(!session.session)throw new Error('Inicia sesión para consultar tu memoria.');
   const docs=await client.from('ai_knowledge').select('id,title,format,source,validation,created_at').eq('workspace_id',project!.workspace_id).eq('project_id',projectId).order('created_at',{ascending:false}).order('id').limit(100);
   if(docs.error)throw new Error('No se pudo cargar la memoria de IA. Comprueba la conexión o la actualización de Supabase.');
   if(current===version.current)setKnowledge((docs.data||[]) as Knowledge[]);
  }catch(err){if(current===version.current)setError(err instanceof Error?err.message:'No se pudo cargar el chat.');}finally{if(current===version.current)setLoading(false);}})();
  return()=>{version.current++;controller.current?.abort();};
 },[projectId,project?.workspace_id,disabled]);
 useEffect(()=>{const box=end.current?.parentElement;if(box)box.scrollTo({top:box.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},[entries,busy]);
 async function send(){
  if(busy||voiceBusy||(!question.trim()&&!files.length)||!project||disabled||!supabase)return;
  const current=version.current,prompt=question.trim()||'Analiza los archivos adjuntos y aporta recomendaciones para este proyecto.';setBusy(true);setError('');
  const abort=new AbortController();controller.current=abort;
  try{
   const {media,documents}=await preparePromptFiles(files,'chat');
   const {data}=await supabase.auth.getSession();if(!data.session)throw new Error('Inicia sesión de nuevo.');
   const response=await fetch('/api/ai/chat',{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({project_id:project.id,question:prompt,media,documents,request_id:crypto.randomUUID()})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo consultar la IA.');
   if(current===version.current){setEntries(rows=>[...rows,result.entry]);setQuestion('');setFiles([]);}
  }catch(err){if(current===version.current&&!abort.signal.aborted)setError(err instanceof Error?err.message:'No se pudo consultar la IA.');}finally{if(current===version.current)setBusy(false);}
 }
 async function importMemory(){
  if(!project||!supabase||!canImport||importing)return;
  setError('');setImporting(true);const current=version.current;
  try{
   const parsed=parseKnowledge(title,content,format,source,reviewed?'reviewed':'unverified');
   const {error:problem,data}=await supabase.from('ai_knowledge').insert({...parsed,workspace_id:project.workspace_id,project_id:project.id}).select('id,title,format,source,validation,created_at').single();
   if(problem)throw new Error('No se pudo importar la información. Revisa tus permisos para crear aprendizajes.');
   if(current===version.current){setKnowledge(rows=>[data as Knowledge,...rows]);setTitle('');setContent('');setSource('');setReviewed(false);setShowImport(false);}
  }catch(err){if(current===version.current)setError(err instanceof Error?err.message:'No se pudo importar.');}finally{if(current===version.current)setImporting(false);}
 }
 async function readFile(file:File){
  try{if(!/\.(txt|csv|json)$/i.test(file.name)||file.size>200000)throw new Error('Usa un archivo TXT, CSV o JSON de hasta 200 KB, codificado en UTF-8.');
   const text=await file.text();if(text.includes('\uFFFD'))throw new Error('Guarda el archivo en UTF-8 antes de importarlo.');
   setTitle(file.name);setContent(text.replace(/^\uFEFF/,''));setFormat(file.name.toLowerCase().endsWith('.csv')?'csv':file.name.toLowerCase().endsWith('.json')?'json':'text');setSource(`Archivo: ${file.name}`);setError('');
  }catch(err){setError(err instanceof Error?err.message:'No se pudo leer el archivo.');}
 }
 async function viewSource(id:string,sourceProject?:string){
  if(!supabase||!project)return;
  const {data,error:problem}=await supabase.from('ai_knowledge').select('*').eq('id',id).eq('workspace_id',project.workspace_id).eq('project_id',sourceProject||project.id).single();
  if(problem)setError('Esta fuente ya no está disponible.');else setViewedSource(data as Knowledge);
 }
 async function remove(row:Knowledge){
  if(!canDelete||!supabase||!project||!window.confirm(`¿Eliminar «${row.title}» de la memoria del proyecto?`))return;
  const {data,error:problem}=await supabase.from('ai_knowledge').delete().eq('id',row.id).eq('workspace_id',project.workspace_id).eq('project_id',project.id).select('id');
  if(problem||!data?.length)setError('No se pudo eliminar esta fuente.');else setKnowledge(rows=>rows.filter(item=>item.id!==row.id));
 }
 return <section className="strategic-ai">
  {disabled&&<p className="notice">Inicia sesión en tu equipo para consultar la IA y su memoria privada.</p>}
  {!project&&<p className="notice">Crea o selecciona un proyecto para empezar.</p>}
  <div className="ai-columns"><div className="panel ai-chat">
   <div className="ai-intro-header">
    <div className="ai-intro-copy">
     <h2><AIBrainIcon size={28}/> IA de {project?.title?.trim().toLowerCase()==='greenhunt'?'Green Hunt':project?.title||'tu proyecto'}</h2>
     <p className="ai-chat-intro">Esta IA recuerda tus experimentos, datos cualitativos y cuantitativos, aprendizajes, métricas y el contexto que aportas a tus proyectos. Cuanta más información documentes, mejores consejos, hipótesis y oportunidades podrá proponerte. Aplica el método científico para descubrir qué necesita el mercado y encontrar tu modelo de negocio adecuado.</p>
    </div>
    <img className="ai-project-mascot" src="/einstein-project-ia.webp" width={160} height={151} alt="Einstein con una bombilla y una probeta" loading="eager" decoding="async"/>
   </div>
   <div className="ai-messages" role="log" aria-label="Conversación con IA">{entries.map(entry=><article key={entry.id} className="ai-exchange"><div className="ai-question"><strong>Tú</strong><p>{entry.question}</p></div><div className="ai-answer"><strong><Sparkles size={15}/> IA</strong><p>{entry.answer}</p>{!!entry.sources.length&&<details><summary>Fuentes consultadas ({entry.sources.length})</summary>{entry.sources.map(row=><div className="ai-source" key={row.id}><button onClick={()=>row.kind.startsWith('import_')?void viewSource(row.id,row.project_id):onSource(row.record_id||row.id)}>{row.title}</button><small>{sourceKind(row.kind)} · {new Date(row.date).toLocaleDateString('es')} </small><p>{row.excerpt.slice(0,450)}</p></div>)}</details>}{entry.coverage.warning&&<p className="notice">{entry.coverage.warning} Revisa la ficha y utiliza Preparar con IA para completar los parámetros antes de ejecutar.</p>}{entry.proposal&&<div className="ai-proposal"><strong><FlaskConical size={17}/> {entry.proposal.title}</strong><p>{entry.proposal.fields.hypothesis}</p>{entry.proposal.questions?.map(q=><p key={q}>{q}</p>)}<button className="btn primary" disabled={!canCreate||busy||voiceBusy} onClick={()=>onProposal(entry.proposal!)}>Revisar y crear experimento</button><small>La ficha se guardará cuando tú lo confirmes.</small></div>}</div></article>)}{busy&&<p role="status">Consultando la memoria y preparando tu respuesta…</p>}<div ref={end}/></div>
   <AIPromptComposer id="strategic-question" projectId={projectId||null} purpose="chat" value={question} onChange={setQuestion} maxLength={6000} files={files} onFiles={setFiles} disabled={disabled||!project||busy||loading} voiceBusy={voiceBusy} onVoiceBusy={setVoiceBusy} busy={busy} placeholder={project?.title?'Pregunta a la IA de '+project.title+'…':'Pregunta a la IA…'} onSubmit={()=>void send()}/>
  </div><aside className="panel ai-memory"><h2><Database size={21}/> Memoria del proyecto</h2><p>Experimentos y aprendizajes se consultan directamente de tus fichas. Añade entrevistas, observaciones, investigaciones o tablas para dar más contexto.</p><button className="btn" disabled={disabled||!project||!canImport} onClick={()=>setShowImport(value=>!value)}><FileUp size={17}/>{showImport?'Cerrar importación':'Importar información'}</button><a className="ai-research-guide-link" href="/guia-investigacion" target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Guía de investigación cualitativa y cuantitativa</a>{!canImport&&!disabled&&<small>Necesitas permiso para crear aprendizajes para añadir información.</small>}
   {showImport&&canImport&&<div className="ai-import"><label>Archivo (TXT, CSV o JSON · hasta 200 KB)<input type="file" accept=".txt,.csv,.json" disabled={importing} onChange={event=>{const file=event.target.files?.[0];if(file)void readFile(file);event.target.value='';}}/></label><label>Título<input maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Tipo de información<select value={format} onChange={e=>setFormat(e.target.value as Knowledge['format'])}><option value="text">Texto cualitativo</option><option value="csv">Tabla CSV</option><option value="json">Datos JSON</option></select></label><label>Contenido<textarea rows={8} maxLength={100000} value={content} onChange={e=>setContent(e.target.value)} placeholder="Pega entrevistas, notas o datos con sus unidades y fechas…"/></label><label>Procedencia<input value={source} maxLength={2000} onChange={e=>setSource(e.target.value)} placeholder="Fuente, enlace, fecha o método de recogida"/></label><label className="ai-reviewed"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>He revisado esta información personalmente</label><button className="btn primary" disabled={importing||!content.trim()||!title.trim()} onClick={()=>void importMemory()}>{importing?'Guardando…':'Guardar en la memoria'}</button></div>}
   {viewedSource&&<div className="ai-source-preview"><strong>{viewedSource.title}</strong><pre>{viewedSource.content}</pre><button className="btn" onClick={()=>setViewedSource(null)}>Cerrar fuente</button></div>}<div className="ai-knowledge-list">{knowledge.length===0&&!loading?<p className="muted">Todavía no hay fuentes adicionales importadas.</p>:null}{knowledge.map(row=><article key={row.id}><button className="btn" onClick={()=>void viewSource(row.id)}>{row.title}</button><small>{row.format.toUpperCase()} · {new Date(row.created_at).toLocaleDateString('es')}</small><span>{row.validation==='reviewed'?<><CheckCircle2 size={14}/>Revisado por una persona</>:'Información sin verificar'}</span>{row.source&&<p>{row.source}</p>}{canDelete&&<button className="btn" aria-label={`Eliminar ${row.title}`} onClick={()=>void remove(row)}><Trash2 size={14}/></button>}</article>)}</div><small className="muted">Se muestran las 100 fuentes importadas más recientes. La IA puede recuperar también las anteriores. Importar y guardar texto no consume OpenAI.</small>
  </aside></div>{error&&<p className="error" role="alert">{error}</p>}
 </section>;
}
function sourceKind(kind:string){if(kind.startsWith("import_"))return kind.includes("reviewed")&&!kind.includes("unverified")?"Fuente revisada por una persona":"Fuente importada sin verificar";return ({project:"Proyecto",experiment:"Experimento",learning:"Aprendizaje documentado",goal:"Objetivo",north_star:"North Star",idea:"Idea",opportunity:"Oportunidad",measurement:"Medición",variant:"Variante",external_resource:"Campaña vinculada"} as Record<string,string>)[kind]||"Ficha del proyecto";}

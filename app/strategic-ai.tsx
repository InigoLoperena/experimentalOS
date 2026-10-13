'use client';
import {useEffect,useRef,useState} from 'react';
import {BookOpen,BrainCircuit,CheckCircle2,Database,FileUp,FlaskConical,Send,Sparkles,Trash2} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {parseKnowledge,type ChatEntry,type Knowledge} from '@/lib/ai-memory';
import type {Preparation} from '@/lib/ai-preparation';
import type {Item} from '@/lib/model';
import {VoiceInput} from './voice-input';

export function AIMemoryDiagram(){
 return <figure className="ai-diagram" aria-label="Arquitectura de la memoria de IA">
  <div className="ai-flow-row"><span><FlaskConical size={20}/>Proyectos · experimentos · resultados</span><span><FileUp size={20}/>Texto · entrevistas · CSV · JSON</span></div>
  <div className="ai-flow-arrow" aria-hidden="true">↓</div>
  <div className="ai-flow-core"><Database size={23}/><strong>Supabase · memoria privada del equipo</strong><small>Fichas + métricas con fechas + información importada con su fuente</small></div>
  <div className="ai-flow-arrow" aria-hidden="true">↓ Información relevante y autorizada</div>
  <div className="ai-flow-row"><span><BrainCircuit size={20}/><strong>Experimental OS</strong><small>Comprueba permisos y selecciona contexto</small></span><b aria-hidden="true">→</b><span><Sparkles size={20}/><strong>OpenAI</strong><small>Razona y prepara una respuesta</small></span></div>
  <div className="ai-flow-arrow" aria-hidden="true">↓</div>
  <div className="ai-flow-row"><span>Chat con fuentes</span><span>Propuesta de experimento → revisión → guardar</span></div>
  <figcaption><BookOpen size={17}/> Experimento → resultados → documentar aprendizajes → Supabase → nuevas recomendaciones.</figcaption>
 </figure>;
}
function Einstein(){return <div className="ai-mascot" role="img" aria-label="Einstein animado experimentando con un matraz y aprendiendo con su cuaderno"><img src="/einstein-ia.webp" alt="" width={220} height={252}/><span className="ai-mascot-spark spark-one" aria-hidden="true">✦</span><span className="ai-mascot-spark spark-two" aria-hidden="true">✧</span><span className="ai-mascot-learning" aria-hidden="true"><BookOpen size={18}/> ¡Aprendizaje!</span></div>;}

export function StrategicAI({project,disabled,canImport,canDelete,canCreate,onProposal,onSource}:{project:Item|null;disabled:boolean;canImport:boolean;canDelete:boolean;canCreate:boolean;onProposal:(proposal:Preparation)=>void;onSource:(id:string)=>void}){
 const [entries,setEntries]=useState<ChatEntry[]>([]),[knowledge,setKnowledge]=useState<Knowledge[]>([]);
 const [question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [title,setTitle]=useState(''),[content,setContent]=useState(''),[format,setFormat]=useState<Knowledge['format']>('text'),[source,setSource]=useState(''),[reviewed,setReviewed]=useState(false),[importing,setImporting]=useState(false);
 const [used,setUsed]=useState<number|null>(null),[showImport,setShowImport]=useState(false);
 const [viewedSource,setViewedSource]=useState<Knowledge|null>(null);
 const [includeOtherProjects,setIncludeOtherProjects]=useState(false);
 const [voiceBusy,setVoiceBusy]=useState(false);
 const end=useRef<HTMLDivElement>(null),version=useRef(0),controller=useRef<AbortController|null>(null);
 const projectId=project?.id;
 useEffect(()=>{
  const current=++version.current;setEntries([]);setKnowledge([]);setError('');setQuestion('');setLoading(true);
  if(disabled||!projectId||!supabase){setLoading(false);return;}
  const client=supabase;
  void (async()=>{try{
   const {data:session}=await client.auth.getSession();
   if(!session.session)throw new Error('Inicia sesión para consultar tu memoria.');
   const [chat,docs]=await Promise.all([
    client.from('ai_chat_entries').select('*').eq('workspace_id',project!.workspace_id).eq('project_id',projectId).eq('user_id',session.session.user.id).order('created_at',{ascending:false}).order('id').limit(30),
    client.from('ai_knowledge').select('id,title,format,source,validation,created_at').eq('workspace_id',project!.workspace_id).eq('project_id',projectId).order('created_at',{ascending:false}).order('id').limit(100),
   ]);
   if(chat.error||docs.error)throw new Error('No se pudo cargar la memoria de IA. Comprueba la conexión o la actualización de Supabase.');
   if(current===version.current){setEntries((chat.data||[]).reverse() as ChatEntry[]);setKnowledge((docs.data||[]) as Knowledge[]);}
  }catch(err){if(current===version.current)setError(err instanceof Error?err.message:'No se pudo cargar el chat.');}finally{if(current===version.current)setLoading(false);}})();
  return()=>{version.current++;controller.current?.abort();};
 },[projectId,project?.workspace_id,disabled]);
 useEffect(()=>{const box=end.current?.parentElement;if(box)box.scrollTo({top:box.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},[entries,busy]);
 async function send(){
  if(busy||voiceBusy||!question.trim()||!project||disabled||!supabase)return;
  const current=version.current,prompt=question.trim();setBusy(true);setError('');
  const abort=new AbortController();controller.current=abort;
  try{
   const {data}=await supabase.auth.getSession();if(!data.session)throw new Error('Inicia sesión de nuevo.');
   const response=await fetch('/api/ai/chat',{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({project_id:project.id,question:prompt,include_other_projects:includeOtherProjects,request_id:crypto.randomUUID()})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo consultar la IA.');
   if(current===version.current){setEntries(rows=>[...rows,result.entry]);setQuestion('');setUsed(result.reserved_usd);}
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
  <div className="ai-welcome panel"><Einstein/><div><span className="eyebrow">TU COMPAÑERO DE EXPERIMENTACIÓN</span><h2>Pregunta. Experimenta. Aprende.</h2><p>Piensa junto a la IA usando los datos de <strong>{project?.title||'tu proyecto'}</strong>. Diseña pruebas, encuentra hipótesis y recupera lo que ya has aprendido.</p><p className="muted">La IA consulta la memoria guardada del proyecto en cada pregunta. Cuantos mejores datos y aprendizajes documentes, más contexto tendrá para ayudarte. No entrenamos un modelo propio.</p></div></div>
  <details className="panel ai-explanation"><summary><CircleInfo/>Cómo funciona y dónde se guarda la información</summary><p>Las fichas, las métricas y la información importada se guardan en Supabase y se comparten con las personas autorizadas de tu equipo. Tu conversación se guarda de forma privada para tu usuario y proyecto; aquí se muestran las últimas 30 consultas.</p><p>El servidor recupera una selección relevante, la envía a OpenAI y devuelve una respuesta con fuentes. No envía claves de integraciones. Si hay mucha información, el chat indica qué parte ha consultado. Las hipótesis de la IA requieren comprobación; importar datos o revisar una nota no demuestra que una hipótesis sea cierta.</p><AIMemoryDiagram/><p>Los adjuntos originales de los experimentos permanecen en Storage privado. Este chat consulta sus fichas y resultados; no lee automáticamente imágenes, vídeos o documentos adjuntos. Para incluir información de un documento, pega su texto o importa TXT, CSV o JSON. Los CSV se conservan con sus cabeceras, unidades y fechas como una fuente; las métricas de campañas se importan en Resultados del experimento.</p><p>Una propuesta abre la ficha del experimento para revisar y guardar. Desde allí puedes preparar una campaña con IA y revisar el envío a su plataforma.</p></details>
  {disabled&&<p className="notice">Inicia sesión en tu equipo para consultar la IA y su memoria privada.</p>}
  {!project&&<p className="notice">Crea o selecciona un proyecto para empezar.</p>}
  <div className="ai-columns"><div className="panel ai-chat"><h2><BrainCircuit size={21}/> Chat estratégico</h2>
   {loading?<p role="status">Cargando tu conversación…</p>:entries.length===0?<div className="ai-empty"><p>¿Por dónde empezamos?</p>{['¿Qué sabemos y qué nos falta comprobar de este proyecto?','Sugiere un experimento A/B a partir de los aprendizajes disponibles.','¿Qué limitaciones tienen los resultados de nuestros experimentos?'].map(text=><button key={text} disabled={disabled||!project||busy||voiceBusy} onClick={()=>setQuestion(text)}>{text}</button>)}</div>:null}
   <div className="ai-messages" role="log" aria-label="Conversación con IA">{entries.map(entry=><article key={entry.id} className="ai-exchange"><div className="ai-question"><strong>Tú</strong><p>{entry.question}</p></div><div className="ai-answer"><strong><Sparkles size={15}/> IA</strong><p>{entry.answer}</p>{!!entry.sources.length&&<details><summary>Fuentes consultadas ({entry.sources.length})</summary>{entry.sources.map(row=><div className="ai-source" key={row.id}><button onClick={()=>row.kind.startsWith('import_')?void viewSource(row.id,row.project_id):onSource(row.record_id||row.id)}>{row.title}</button><small>{sourceKind(row.kind)} · {new Date(row.date).toLocaleDateString('es')} </small><p>{row.excerpt.slice(0,450)}</p></div>)}</details>}{entry.coverage.warning&&<p className="notice">{entry.coverage.warning} Revisa la ficha y utiliza Preparar con IA para completar los parámetros antes de ejecutar.</p>}<small className="muted">Ámbito: {entry.coverage.scope==='workspace'?'proyectos autorizados del equipo':'proyecto seleccionado'}. Contexto seleccionado: {entry.coverage.included} de {entry.coverage.available} fichas, fragmentos y datos disponibles para esta consulta.</small>{entry.proposal&&<div className="ai-proposal"><strong><FlaskConical size={17}/> {entry.proposal.title}</strong><p>{entry.proposal.fields.hypothesis}</p>{entry.proposal.questions?.map(q=><p key={q}>{q}</p>)}<button className="btn primary" disabled={!canCreate||busy||voiceBusy} onClick={()=>onProposal(entry.proposal!)}>Revisar y crear experimento</button><small>La ficha se guardará cuando tú lo confirmes.</small></div>}</div></article>)}{busy&&<p role="status">Consultando la memoria y preparando tu respuesta…</p>}<div ref={end}/></div>
   <form className="ai-composer" onSubmit={event=>{event.preventDefault();void send();}}><label className="ai-scope-toggle"><input type="checkbox" checked={includeOtherProjects} disabled={disabled||!project||busy||voiceBusy} onChange={event=>setIncludeOtherProjects(event.target.checked)}/>Incluir otros proyectos de mi equipo</label><label htmlFor="strategic-question">Tu pregunta o petición</label><textarea id="strategic-question" value={question} onChange={event=>setQuestion(event.target.value)} maxLength={6000} rows={4} placeholder="Por ejemplo: diseña un experimento para comprobar esta hipótesis…" disabled={disabled||!project||busy||voiceBusy}/><VoiceInput projectId={projectId||null} purpose="chat" value={question} onChange={setQuestion} maxLength={6000} disabled={disabled||!project||busy||loading||voiceBusy} onBusy={setVoiceBusy} label="Grabar audio para la consulta de IA"/><button className="btn primary" disabled={disabled||!project||busy||voiceBusy||loading||!question.trim()}><Send size={16}/>{busy?'Pensando…':'Preguntar a la IA'}</button><small className="muted">Límite compartido: 5 USD/mes por equipo. Cada consulta reserva 0,03 USD, incluso si falla; es una estimación de control.{used!==null?` Reservado este mes: ${used.toFixed(2)} USD.`:''}</small></form>
  </div><aside className="panel ai-memory"><h2><Database size={21}/> Memoria del proyecto</h2><p>Experimentos y aprendizajes se consultan directamente de tus fichas. Añade entrevistas, observaciones, investigaciones o tablas para dar más contexto.</p><button className="btn" disabled={disabled||!project||!canImport} onClick={()=>setShowImport(value=>!value)}><FileUp size={17}/>{showImport?'Cerrar importación':'Importar información'}</button>{!canImport&&!disabled&&<small>Necesitas permiso para crear aprendizajes para añadir información.</small>}
   {showImport&&canImport&&<div className="ai-import"><label>Archivo (TXT, CSV o JSON · hasta 200 KB)<input type="file" accept=".txt,.csv,.json" disabled={importing} onChange={event=>{const file=event.target.files?.[0];if(file)void readFile(file);event.target.value='';}}/></label><label>Título<input maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Tipo de información<select value={format} onChange={e=>setFormat(e.target.value as Knowledge['format'])}><option value="text">Texto cualitativo</option><option value="csv">Tabla CSV</option><option value="json">Datos JSON</option></select></label><label>Contenido<textarea rows={8} maxLength={100000} value={content} onChange={e=>setContent(e.target.value)} placeholder="Pega entrevistas, notas o datos con sus unidades y fechas…"/></label><label>Procedencia<input value={source} maxLength={2000} onChange={e=>setSource(e.target.value)} placeholder="Fuente, enlace, fecha o método de recogida"/></label><label className="ai-reviewed"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>He revisado esta información personalmente</label><button className="btn primary" disabled={importing||!content.trim()||!title.trim()} onClick={()=>void importMemory()}>{importing?'Guardando…':'Guardar en la memoria'}</button></div>}
   {viewedSource&&<div className="ai-source-preview"><strong>{viewedSource.title}</strong><pre>{viewedSource.content}</pre><button className="btn" onClick={()=>setViewedSource(null)}>Cerrar fuente</button></div>}<div className="ai-knowledge-list">{knowledge.length===0&&!loading?<p className="muted">Todavía no hay fuentes adicionales importadas.</p>:null}{knowledge.map(row=><article key={row.id}><button className="btn" onClick={()=>void viewSource(row.id)}>{row.title}</button><small>{row.format.toUpperCase()} · {new Date(row.created_at).toLocaleDateString('es')}</small><span>{row.validation==='reviewed'?<><CheckCircle2 size={14}/>Revisado por una persona</>:'Información sin verificar'}</span>{row.source&&<p>{row.source}</p>}{canDelete&&<button className="btn" aria-label={`Eliminar ${row.title}`} onClick={()=>void remove(row)}><Trash2 size={14}/></button>}</article>)}</div><small className="muted">Se muestran las 100 fuentes importadas más recientes. La IA puede recuperar también las anteriores. Importar y guardar texto no consume OpenAI.</small>
  </aside></div>{error&&<p className="error" role="alert">{error}</p>}
 </section>;
}
function CircleInfo(){return <BrainCircuit size={18} aria-hidden="true"/>;}

function sourceKind(kind:string){if(kind.startsWith("import_"))return kind.includes("reviewed")&&!kind.includes("unverified")?"Fuente revisada por una persona":"Fuente importada sin verificar";return ({project:"Proyecto",experiment:"Experimento",learning:"Aprendizaje documentado",goal:"Objetivo",north_star:"North Star",idea:"Idea",opportunity:"Oportunidad",measurement:"Medición",variant:"Variante",external_resource:"Campaña vinculada"} as Record<string,string>)[kind]||"Ficha del proyecto";}

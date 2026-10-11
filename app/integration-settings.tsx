'use client';
import {useEffect,useRef,useState} from 'react';
import {Plug,ShieldCheck} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import type {Item} from '@/lib/model';
import {integrationCatalog,integrationFields,type IntegrationProvider,type Connection} from '@/lib/integrations';
type Payload={connections:Connection[];can_configure:boolean;storage_ready:boolean};
export function IntegrationSettings({workspaceId,projects,demo,onSaved,onBusy}:{workspaceId:string;projects:Item[];demo:boolean;onSaved:()=>Promise<void>;onBusy:(busy:boolean)=>void}){
 const [provider,setProvider]=useState<IntegrationProvider>('openai');
 const [projectId,setProjectId]=useState(projects[0]?.id||'');
 const [data,setData]=useState<Payload|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const active=useRef(false),flight=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;onBusy(false);};},[onBusy]);
 useEffect(()=>{if(!projects.some(p=>p.id===projectId))setProjectId(projects[0]?.id||'');},[projects,projectId]);
 async function request(body:Record<string,unknown>){
  const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error('Inicia sesión para continuar.');
  const response=await fetch('/api/integrations',{method:'POST',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({...body,workspace_id:workspaceId})});
  const value=await response.json();if(!response.ok)throw new Error(value.error||'No se pudo completar la configuración.');return value;
 }
 async function load(){const value=await request({action:'list'});if(active.current)setData(value);}
 useEffect(()=>{if(demo)return;void load().catch(err=>{if(active.current)setError(err.message);});},[workspaceId,demo]); // Remounted for each workspace.
 async function run(body:Record<string,unknown>){
  if(flight.current||demo)return;flight.current=true;setBusy(true);onBusy(true);setError('');
  try{if(body.action!=='list')await request(body);await load();if(body.action==='save'&&provider==='posthog')await onSaved();}
  catch(err){if(active.current)setError(err instanceof Error?err.message:'No se pudo guardar.');throw err;}
  finally{flight.current=false;onBusy(false);if(active.current)setBusy(false);}
 }
 const selectedProject=integrationCatalog[provider].scope==='workspace'?null:projectId;
 const connection=data?.connections.find(row=>row.provider===provider&&row.project_id===selectedProject)||null;
 return <section className="integrations-panel">
  <div className="notice"><ShieldCheck size={18}/><span>Conexiones compartidas por equipo. Solo el superadministrador configura las APIs; los colaboradores consultan su estado. Las claves se guardan privadas, cifradas, y no vuelven a mostrarse.</span></div>
  {demo&&<p className="notice">La demostración permite explorar el panel. No introduzcas claves reales: las conexiones requieren una sesión de tu equipo.</p>}
  {error&&<p className="error" role="alert">{error}</p>}
  {!demo&&<button type="button" className="btn" disabled={busy} onClick={()=>void run({action:'list'}).catch(()=>{})}>Actualizar integraciones</button>}
  {!data&&!demo&&!error&&<p role="status">Cargando integraciones…</p>}
  <div className="integration-layout"><nav className="integration-list" aria-label="Proveedores de integraciones">
   {(Object.entries(integrationCatalog) as [IntegrationProvider,typeof integrationCatalog[IntegrationProvider]][]).map(([key,value])=><button type="button" key={key} disabled={busy} className={provider===key?'selected':''} aria-pressed={provider===key} onClick={()=>setProvider(key)}><Plug size={17}/>{value.name}</button>)}
  </nav><div className="panel integration-form">
   <h2>{integrationCatalog[provider].name}</h2><p>{integrationCatalog[provider].capability}</p>
   {integrationCatalog[provider].scope==='project'?<label>Proyecto<select aria-label="Proyecto de la integración" disabled={busy} value={projectId} onChange={e=>setProjectId(e.target.value)}>{projects.map(project=><option value={project.id} key={project.id}>{project.title}</option>)}</select></label>:<p className="small">Una conexión de OpenAI para los proyectos de este equipo. Límite inicial de IA: 5 USD estimados al mes por equipo.</p>}
   <p className="integration-status" role="status">{!connection?'Sin configurar':!connection.enabled?'Desactivada':connection.verified_at?'Conexión comprobada':integrationCatalog[provider].testable?'Configurada · pendiente de comprobación':'Configurada · funcionalidad API pendiente'}</p>
   {connection?.verified_at&&<p className="small">{connection.verification_note}<br/>Última comprobación: {new Date(connection.verified_at).toLocaleString('es')}</p>}
   {!data?.can_configure&&!demo&&data&&<p className="notice">Acceso de consulta. El superadministrador del equipo puede cambiar esta configuración.</p>}
   {data?.can_configure&&!data.storage_ready&&<p className="notice">El almacén privado necesita activarse en el servidor antes de guardar claves nuevas. Las conexiones existentes siguen disponibles.</p>}
   <ConnectionForm key={`${provider}:${selectedProject}:${connection?.updated_at||'new'}`} provider={provider} projectId={selectedProject} connection={connection} editable={!!data?.can_configure&&!demo&&data.storage_ready} busy={busy} run={run}/>
   <a className="project-link" href={integrationCatalog[provider].docs} target="_blank" rel="noopener noreferrer">Dónde obtener los datos de {integrationCatalog[provider].name}</a>
  </div></div>
 </section>;
}
function ConnectionForm({provider,projectId,connection,editable,busy,run}:{provider:IntegrationProvider;projectId:string|null;connection:Connection|null;editable:boolean;busy:boolean;run:(body:Record<string,unknown>)=>Promise<void>}){
 const [config,setConfig]=useState<Record<string,string>>(connection?.config||(provider==='posthog'?{host:'https://us.posthog.com'}:{})),[secrets,setSecrets]=useState<Record<string,string>>({}),[message,setMessage]=useState('');
 const fields=integrationFields(provider),canSave=editable&&(integrationCatalog[provider].scope==='workspace'||!!projectId);
 const common={provider,project_id:projectId,expected:connection?.updated_at??null};
 async function action(body:Record<string,unknown>){setMessage('');try{await run({...common,...body});setSecrets({});setMessage(body.action==='save'?'Configuración guardada. Comprueba la conexión cuando esté disponible.':body.action==='verify'?'Comprobación terminada.':'Estado actualizado.');}catch{/* The parent shows the sanitized error. */}}
 return <form onSubmit={e=>{e.preventDefault();void action({action:'save',config,secrets});}}>
  <div className="integration-fields">{fields.map(field=><label key={field.key}>{field.label}{field.required?' *':' · opcional'}
   {field.format==='host'?<select aria-label={field.label} disabled={!canSave||busy} value={config[field.key]||'https://us.posthog.com'} onChange={e=>setConfig({...config,[field.key]:e.target.value})}><option value="https://us.posthog.com">PostHog US</option><option value="https://eu.posthog.com">PostHog EU</option><option value="https://app.posthog.com">PostHog Cloud</option></select>:
    ['pem','json'].includes(field.format||'')?<textarea aria-label={field.label} rows={4} autoComplete="off" spellCheck={false} disabled={!canSave||busy} value={secrets[field.key]||''} placeholder={connection?.secret_fields.includes(field.key)?'Guardada · deja vacío para conservarla':''} onChange={e=>setSecrets({...secrets,[field.key]:e.target.value})}/>:
     <input aria-label={field.label} type={field.secret?'password':field.format==='date'?'date':'text'} autoComplete={field.secret?'new-password':'off'} spellCheck={false} disabled={!canSave||busy} maxLength={field.secret?30000:300} value={(field.secret?secrets:config)[field.key]||''} placeholder={field.secret&&connection?.secret_fields.includes(field.key)?'Guardada · deja vacío para conservarla':''} onChange={e=>field.secret?setSecrets({...secrets,[field.key]:e.target.value}):setConfig({...config,[field.key]:e.target.value})}/>
   }{field.secret&&connection?.secret_fields.includes(field.key)&&<span className="small">Clave guardada y privada. Introduce otra solamente para reemplazarla.</span>}
  </label>)}</div>
  <p className="small">Guardar no prueba ni publica campañas. «Comprobar conexión» consulta únicamente el proveedor. Desactivar conserva la configuración y detiene su uso en Experimental OS.</p>
  {editable&&<div className="row integration-actions"><button type="submit" className="btn primary" disabled={!canSave||busy}>{busy?'Procesando…':'Guardar configuración'}</button>
   {connection&&integrationCatalog[provider].testable&&<button type="button" className="btn" disabled={busy||!connection.enabled} onClick={()=>void action({action:'verify'})}>Comprobar conexión</button>}
   {connection&&<button type="button" className="btn" disabled={busy} onClick={()=>void action({action:'state',enabled:!connection.enabled})}>{connection.enabled?'Desactivar':'Activar conexión'}</button>}
  </div>}
  {message&&<p role="status">{message}</p>}
 </form>;
}

'use client';
import {useEffect,useRef,useState} from 'react';
import {Plug,ShieldCheck} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import type {Item} from '@/lib/model';
import {integrationCatalog,integrationFields,type IntegrationProvider,type Connection} from '@/lib/integrations';
import {MetaConnectionGuide} from './meta-connection-guide';
import {GoogleConnectionGuide} from './google-connection-guide';
import {PosthogConnectionGuide} from './posthog-connection-guide';
import {workspaceConnectionChoice,integrationProfileFields,type IntegrationProfile} from '@/lib/workspace-connection';
type Payload={connections:Connection[];profiles:IntegrationProfile[];can_configure:boolean;storage_ready:boolean};
export function IntegrationSettings({workspaceId,projects,demo,onSaved,onBusy}:{workspaceId:string;projects:Item[];demo:boolean;onSaved:()=>Promise<void>;onBusy:(busy:boolean)=>void}){
 const [provider,setProvider]=useState<IntegrationProvider>('openai');
 const [projectId,setProjectId]=useState(projects[0]?.id||'');
 const [data,setData]=useState<Payload|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [failedChecks,setFailedChecks]=useState<Record<string,string>>({});
 const active=useRef(false),flight=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;onBusy(false);};},[onBusy]);
 useEffect(()=>{if(!projects.some(p=>p.id===projectId))setProjectId(projects[0]?.id||'');},[projects,projectId]);
 async function request(body:Record<string,unknown>){
  const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error('Inicia sesión para continuar.');
  const response=await fetch('/api/integrations',{method:'POST',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({...body,workspace_id:workspaceId})});
  let value;try{value=await response.json();}catch{throw new Error('El servidor no respondió correctamente. La configuración no se ha confirmado; actualiza antes de reintentar.');}if(!response.ok)throw new Error(value.error||'No se pudo completar la configuración.');return value;
 }
 async function load(){const value=await request({action:'list'});if(active.current)setData(value);}
 useEffect(()=>{if(demo)return;void load().catch(err=>{if(active.current)setError(err.message);});},[workspaceId,demo]); // Remounted for each workspace.
 async function run(body:Record<string,unknown>){
  if(flight.current||demo)return;flight.current=true;setBusy(true);onBusy(true);setError('');setMessage('');
  try{if(body.action!=='list')await request(body);await load();if(body.action==='save'&&provider==='posthog')await onSaved();if(active.current){if(body.action==='verify'||body.action==='save')setFailedChecks(previous=>{const next={...previous};delete next[`${body.provider}:${body.project_id??'workspace'}`];return next;});setMessage(body.action==='save'?'Configuración guardada. Comprueba la conexión cuando esté disponible.':body.action==='verify'?'Comprobación terminada.':body.action==='list'?'Integraciones actualizadas.':'Estado actualizado.');}}
  catch(err){if(active.current){const reason=err instanceof Error?err.message:'No se pudo guardar.';setError(reason);if(body.action==='verify')setFailedChecks(previous=>({...previous,[`${body.provider}:${body.project_id??'workspace'}`]:reason}));}throw err;}
  finally{flight.current=false;onBusy(false);if(active.current)setBusy(false);}
 }
 const connection=workspaceConnectionChoice(data?.connections||[],provider);
 const failedCheck=failedChecks[`${provider}:workspace`];
 const alternatives=data?.connections.filter(row=>row.provider===provider&&row.id!==connection?.id)||[];
 const profile=data?.profiles?.find(row=>row.provider===provider&&row.project_id===projectId&&row.connection_id===connection?.id)||null;
 return <section className="integrations-panel">
  <div className="notice"><ShieldCheck size={18}/><span>Conexiones compartidas dentro de cada equipo. El administrador de cada equipo configura sus APIs; los colaboradores consultan su estado. Las claves se guardan privadas, cifradas, y no vuelven a mostrarse.</span></div>
  {demo&&<p className="notice">La demostración permite explorar el panel. No introduzcas claves reales: las conexiones requieren una sesión de tu equipo.</p>}
  {error&&<p className="error" role="alert">{error}</p>}
  {message&&<p className="notice" role="status">{message}</p>}
  {!demo&&<button type="button" className="btn" disabled={busy} onClick={()=>void run({action:'list'}).catch(()=>{})}>Actualizar integraciones</button>}
  {!data&&!demo&&!error&&<p role="status">Cargando integraciones…</p>}
  <div className="integration-layout"><nav className="integration-list" aria-label="Proveedores de integraciones">
   {(Object.entries(integrationCatalog) as [IntegrationProvider,typeof integrationCatalog[IntegrationProvider]][]).map(([key,value])=><button type="button" key={key} disabled={busy} className={provider===key?'selected':''} aria-pressed={provider===key} onClick={()=>{setProvider(key);setError('');setMessage('');}}><Plug size={17}/>{value.name}</button>)}
  </nav><div className="panel integration-form">
   <h2>{integrationCatalog[provider].name}</h2><p>{integrationCatalog[provider].capability}</p>
   {provider==='meta_ads'&&<MetaConnectionGuide/>}
   {provider==='google_ads'&&<GoogleConnectionGuide/>}
   {provider==='posthog'&&<PosthogConnectionGuide/>}
   <p className="notice">Una cuenta de {integrationCatalog[provider].name} para todos los proyectos de este espacio de trabajo. Las campañas y resultados siguen asociados a su proyecto y experimento.</p>
   {provider==='openai'&&<p className="small">Límite interno de Xperiments: 5 USD reservados al mes por equipo, independiente del presupuesto o saldo de OpenAI Platform. «Comprobar conexión» genera una respuesta mínima (unos pocos tokens) para detectar problemas de clave, permisos o cuota, sin guardar fichas.</p>}
   {!!alternatives.length&&<details className="monitoring-block"><summary>Conexiones anteriores</summary><p>Conservamos las conexiones existentes. Elige cuál utilizar en todos los proyectos:</p>{alternatives.map(row=><button key={row.id} type="button" className="btn" disabled={busy||!data?.can_configure||row.source!=='encrypted'} onClick={()=>void run({action:'share',provider,connection_id:row.id,expected:row.updated_at}).catch(()=>{})}>{row.config.account_id||row.config.customer_id||projects.find(p=>p.id===row.project_id)?.title||'Cuenta guardada'}</button>)}</details>}
   <p className="integration-status" role="status">{!connection?'Sin configurar':!connection.enabled?'Desactivada para todos los proyectos':failedCheck?'Comprobación fallida':connection.verified_at?'Comprobada anteriormente':integrationCatalog[provider].testable?'Configurada · pendiente de comprobación':'Configurada · funcionalidad API pendiente'}</p>
   {failedCheck&&<p className="error">{failedCheck}</p>}
   {connection?.verified_at&&<p className="small">{connection.verification_note}<br/>Última comprobación correcta: {new Date(connection.verified_at).toLocaleString('es')}</p>}
   {!data?.can_configure&&!demo&&data&&<p className="notice">Acceso de consulta. El administrador de tu equipo puede cambiar esta configuración.</p>}
   {data?.can_configure&&!data.storage_ready&&<p className="notice">El almacén privado necesita activarse en el servidor antes de guardar claves nuevas. Las conexiones existentes siguen disponibles.</p>}
   <ConnectionForm key={`${provider}:${connection?.updated_at||'new'}`} provider={provider} projectId={null} connection={connection} editable={!!data?.can_configure&&!demo&&data.storage_ready} busy={busy} run={run}/>
   {connection&&integrationProfileFields[provider]&&<details className="monitoring-block"><summary>Perfiles por proyecto · opcional</summary><p className="small">La clave sigue siendo la del espacio. Puedes elegir una marca de Metricool, un proyecto de PostHog, una app o un píxel diferente. En PostHog se mantienen los identificadores ya registrados en cada proyecto.</p><label>Proyecto<select aria-label="Proyecto del perfil" disabled={busy} value={projectId} onChange={e=>setProjectId(e.target.value)}>{projects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select></label><ProjectProfileForm key={`${provider}:${projectId}:${profile?.updated_at||'default'}`} provider={provider} projectId={projectId} connection={connection} profile={profile} editable={!!data?.can_configure&&!demo} busy={busy} run={run} request={request}/></details>}
   <a className="project-link" href={integrationCatalog[provider].docs} target="_blank" rel="noopener noreferrer">Dónde obtener los datos de {integrationCatalog[provider].name}</a>
  </div></div>
 </section>;
}
function ConnectionForm({provider,projectId,connection,editable,busy,run}:{provider:IntegrationProvider;projectId:string|null;connection:Connection|null;editable:boolean;busy:boolean;run:(body:Record<string,unknown>)=>Promise<void>}){
 const [config,setConfig]=useState<Record<string,string>>(connection?.config||(provider==='posthog'?{host:'https://us.posthog.com'}:provider==='google_ads'?{auth_method:'service_account'}:{})),[secrets,setSecrets]=useState<Record<string,string>>({});
 const [fileError,setFileError]=useState('');
 const service=provider==='google_ads'&&config.auth_method==='service_account';
 const fields=integrationFields(provider).filter(field=>provider!=='google_ads'||field.key!=='developer_token'&&(service?!['client_id','client_secret','refresh_token'].includes(field.key):field.key!=='service_account')),canSave=editable&&(integrationCatalog[provider].scope==='workspace'||!!projectId);
 const common={provider,project_id:projectId,connection_id:connection?.id,expected:connection?.updated_at??null};
 async function action(body:Record<string,unknown>){try{await run({...common,...body});setSecrets({});}catch{/* The parent shows the sanitized error. */}}
 async function importServiceFile(file:File|undefined){
  setFileError('');if(!file)return;
  if(file.size>30000){setFileError('El archivo JSON supera el tamaño admitido. Usa la clave original de Google Cloud.');return;}
  try{const raw=await file.text(),parsed=JSON.parse(raw);if(parsed?.type!=='service_account'||typeof parsed.private_key!=='string'||typeof parsed.client_email!=='string')throw new Error();setSecrets(previous=>({...previous,service_account:raw}));}
  catch{setFileError('Selecciona el archivo JSON privado de una cuenta de servicio de Google Cloud.');}
 }
 return <form onSubmit={e=>{e.preventDefault();void action({action:'save',config,secrets});}}>
  {service&&<label>Importar archivo JSON privado<input type="file" accept=".json,application/json" disabled={!canSave||busy} onChange={e=>void importServiceFile(e.target.files?.[0])}/><span className="small">El archivo solo se envía al servidor al guardar la conexión. Su clave queda cifrada y no se muestra después.</span></label>}
  {fileError&&<p className="error" role="alert">{fileError}</p>}
  <div className="integration-fields">{fields.map(field=><label key={field.key}>{field.label}{field.required||(provider==='google_ads'&&['auth_method',...(service?['service_account']:['client_id','client_secret','refresh_token'])].includes(field.key))?' *':' · opcional'}
   {field.format==='google_auth'?<select aria-label={field.label} disabled={!canSave||busy} value={config.auth_method||'oauth'} onChange={e=>setConfig({...config,auth_method:e.target.value})}><option value="service_account">Cuenta de servicio · recomendada para tu cuenta</option><option value="oauth">OAuth · autorización de un usuario</option></select>:field.format==='host'?<select aria-label={field.label} disabled={!canSave||busy} value={config[field.key]||'https://us.posthog.com'} onChange={e=>setConfig({...config,[field.key]:e.target.value})}><option value="https://us.posthog.com">PostHog US</option><option value="https://eu.posthog.com">PostHog EU</option><option value="https://app.posthog.com">PostHog Cloud</option></select>:
    ['pem','json'].includes(field.format||'')?<textarea aria-label={field.label} rows={4} autoComplete="off" spellCheck={false} disabled={!canSave||busy} value={secrets[field.key]||''} placeholder={connection?.secret_fields.includes(field.key)?'Guardada · deja vacío para conservarla':''} onChange={e=>setSecrets({...secrets,[field.key]:e.target.value})}/>:
     <input aria-label={field.label} type={field.secret?'password':field.format==='date'?'date':'text'} autoComplete={field.secret?'new-password':'off'} spellCheck={false} disabled={!canSave||busy} maxLength={field.secret?30000:300} value={(field.secret?secrets:config)[field.key]||''} placeholder={field.secret&&connection?.secret_fields.includes(field.key)?'Guardada · deja vacío para conservarla':''} onChange={e=>field.secret?setSecrets({...secrets,[field.key]:e.target.value}):setConfig({...config,[field.key]:e.target.value})}/>
   }{field.secret&&connection?.secret_fields.includes(field.key)&&<span className="small">Clave guardada y privada. Introduce otra solamente para reemplazarla.</span>}{field.help&&<span className="small">{field.help}</span>}
  </label>)}</div>
  <p className="small">Guardar no prueba ni publica campañas. «Comprobar conexión» consulta al proveedor; para OpenAI realiza una generación de prueba de coste mínimo. Desactivar conserva la configuración y detiene su uso en Xperiments.</p>
  {editable&&<div className="row integration-actions"><button type="submit" className="btn primary" disabled={!canSave||busy}>{busy?'Procesando…':'Guardar configuración'}</button>
   {connection&&integrationCatalog[provider].testable&&<button type="button" className="btn" disabled={busy||!connection.enabled} onClick={()=>void action({action:'verify'})}>Comprobar conexión</button>}
   {connection&&<button type="button" className="btn" disabled={busy} onClick={()=>void action({action:'state',enabled:!connection.enabled})}>{connection.enabled?'Desactivar':'Activar conexión'}</button>}
  </div>}
 </form>;
}

function ProjectProfileForm({provider,projectId,connection,profile,editable,busy,run,request}:{provider:IntegrationProvider;projectId:string;connection:Connection;profile:IntegrationProfile|null;editable:boolean;busy:boolean;run:(body:Record<string,unknown>)=>Promise<void>;request:(body:Record<string,unknown>)=>Promise<any>}){
 const [config,setConfig]=useState<Record<string,string>>(profile?.config||{}),[brands,setBrands]=useState<{id:string;name:string}[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const common={provider,project_id:projectId,connection_id:connection.id,expected:profile?.updated_at||null};
 async function save(value:Record<string,string>){try{await run({...common,action:'profile',profile:value});}catch{/* Parent shows the error. */}}
 async function loadBrands(){setLoading(true);setError('');try{const result=await request({action:'brands',provider,connection_id:connection.id});setBrands(result.brands);}catch(err){setError(err instanceof Error?err.message:'No se pudieron consultar las marcas.');}finally{setLoading(false);}}
 return <form onSubmit={e=>{e.preventDefault();void save(config);}}>
  {provider==='metricool'&&<button type="button" className="btn" disabled={!editable||busy||loading} onClick={()=>void loadBrands()}>{loading?'Consultando…':'Consultar marcas de Metricool'}</button>}
  {error&&<p className="error">{error}</p>}
  {(integrationProfileFields[provider]||[]).map(field=><label key={field.key}>{field.label}
   {field.format==='host'?<select disabled={!editable||busy} aria-label={field.label} value={config[field.key]||connection.config[field.key]} onChange={e=>setConfig({...config,[field.key]:e.target.value})}><option value="https://us.posthog.com">PostHog US</option><option value="https://eu.posthog.com">PostHog EU</option><option value="https://app.posthog.com">PostHog Cloud</option></select>:provider==='metricool'&&brands.length?<select disabled={!editable||busy} aria-label={field.label} value={config.blog_id||connection.config.blog_id} onChange={e=>setConfig({blog_id:e.target.value})}>{brands.map(brand=><option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>:<input disabled={!editable||busy} aria-label={field.label} maxLength={300} value={config[field.key]||''} placeholder={connection.config[field.key]||'Usar el valor de la cuenta compartida'} onChange={e=>setConfig({...config,[field.key]:e.target.value})}/>}</label>)}
  {editable&&<div className="row"><button className="btn" type="submit" disabled={busy||!projectId||!connection.enabled}>Guardar perfil</button><button className="btn" type="button" disabled={busy||!profile} onClick={()=>void save({})}>Usar perfil predeterminado</button></div>}
 </form>;
}

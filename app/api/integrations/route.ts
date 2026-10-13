import {NextResponse} from 'next/server';
import {authenticatedClient,authorizedProject,ApiError} from '@/lib/server-access';
import {type Connection,integrationProvider,integrationCatalog,integrationFields,validateIntegration} from '@/lib/integrations';
import {connectionSecrets,storedConnection} from '@/lib/integration-service';
import {sealSecrets} from '@/lib/integration-secrets';
import {metaAccount} from '@/lib/meta-ads';
import {googleAccessToken,googleAccount} from '@/lib/google-ads';
import {metricoolBrand} from '@/lib/metricool';
import {posthogHost,posthogIdentifier} from '@/lib/posthog-api';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
async function verify(row:Connection,secrets:Record<string,string>){
 if(row.provider==='google_ads'){const c={customerId:row.config.customer_id,loginCustomerId:row.config.login_customer_id,clientId:row.config.client_id,clientSecret:secrets.client_secret,refreshToken:secrets.refresh_token};const account=await googleAccount(c,await googleAccessToken(c));return `Cuenta comprobada: ${account.name} · ${account.currency} · ${account.timezone}${account.test?' · prueba':''}.`;}
 if(row.provider==='metricool'){const brand=await metricoolBrand({userId:row.config.user_id,blogId:row.config.blog_id,token:secrets.api_key});return `Marca comprobada: ${brand.name} · ${brand.timezone}.`;}
 if(row.provider==='meta_ads'){
  const account=await metaAccount({accountId:row.config.account_id,token:secrets.access_token});
  if(secrets.write_token)await metaAccount({accountId:row.config.account_id,token:secrets.write_token});
  return `Lectura comprobada: ${account.name} · ${account.currency}. ${secrets.write_token?'Token de preparación con acceso a la cuenta; ads_management se valida al crear.':'Sin token de preparación.'}`;
 }
 let response:Response;
 try{
  const url=row.provider==='openai'?'https://api.openai.com/v1/models/gpt-4.1-mini-2025-04-14':`${posthogHost(row.config.host)}/api/projects/${posthogIdentifier(row.config.project_id)}/`;
  response=await fetch(url,{headers:{Authorization:`Bearer ${secrets.api_key}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 }catch{throw new ApiError('El proveedor no respondió. La configuración sigue guardada; puedes volver a comprobarla.',502);}
 if(!response.ok)throw new ApiError('El proveedor rechazó la conexión. Revisa la clave, permisos y cuenta. No se han enviado cambios.',502);
 const body=await response.json().catch(()=>null);
 if(row.provider==='openai'){
  if(body?.id!=='gpt-4.1-mini-2025-04-14')throw new ApiError('OpenAI no confirmó el modelo configurado.',502);
  return 'Acceso al modelo comprobado. El saldo y los límites de facturación se revisan en OpenAI; no se ha generado contenido.';
 }
 if(String(body?.id)!==row.config.project_id)throw new ApiError('PostHog no confirmó el proyecto indicado.',502);
 return 'Acceso al proyecto comprobado. Los permisos para experimentos se validan al consultarlos.';
}
export async function POST(request:Request){
 try{
  const {client,user}=await authenticatedClient(request);
  const raw=await request.text();if(Buffer.byteLength(raw)>60000)throw new ApiError('La configuración es demasiado larga.',400);
  let body;try{body=JSON.parse(raw);}catch{throw new ApiError('Solicitud inválida.',400);}
  if(!body||typeof body.workspace_id!=='string'||!['list','save','verify','state'].includes(body.action))throw new ApiError('Selecciona una acción y un equipo válidos.',400);
  const member=await client.from('members').select('role').eq('workspace_id',body.workspace_id).eq('user_id',user.id).single();
  if(member.error||!member.data)throw new ApiError('No tienes acceso a ese equipo.',403);
  if(body.action==='list'){
   const result=await client.from('integration_connections').select('*').eq('workspace_id',body.workspace_id).order('provider');
   if(result.error)throw new ApiError('No se pudo cargar Integraciones. Actualiza los datos.',503);
   const legacy:Partial<Record<string,Record<string,string|undefined>>>={openai:{api_key:process.env.OPENAI_API_KEY},meta_ads:{access_token:process.env.META_ADS_ACCESS_TOKEN,write_token:process.env.META_ADS_WRITE_ACCESS_TOKEN},posthog:{api_key:process.env.POSTHOG_PERSONAL_API_KEY}};
   const connections=(result.data as Connection[]).map(row=>({...row,secret_fields:row.source==='server'?integrationFields(row.provider).filter(f=>f.secret&&!!legacy[row.provider]?.[f.key]).map(f=>f.key):row.secret_fields}));
   return NextResponse.json({connections,can_configure:member.data.role==='owner',storage_ready:/^[a-f0-9]{64}$/i.test(process.env.INTEGRATIONS_ENCRYPTION_KEY||'')},{headers});
  }
  if(member.data.role!=='owner')throw new ApiError('Solo el superadministrador configura las APIs. Tus permisos sobre fichas se gestionan en Equipo.',403);
  const provider=integrationProvider(body.provider),scope=integrationCatalog[provider].scope;
  let project;
  if(scope==='project'){
   if(typeof body.project_id!=='string')throw new ApiError('Selecciona un proyecto.',400);
   project=await authorizedProject(client,body.project_id);if(project.workspace_id!==body.workspace_id)throw new ApiError('Proyecto de otro equipo.',403);
  }else if(body.project_id!=null)throw new ApiError('OpenAI se configura para el equipo.',400);
  const row=await storedConnection(client,body.workspace_id,provider,project?.id||null);
  if(body.action==='save'){
   let previous:Record<string,string>={};
   const replacements=body.secrets;
   if(!replacements||typeof replacements!=='object'||Array.isArray(replacements)||Object.values(replacements).some(v=>typeof v!=='string'))throw new ApiError('Revisa las claves.',400);
   if(row){
    try{previous=await connectionSecrets(client,{...row,enabled:true},project);}
    catch(error){
     // Full replacement permits recovery after key loss; partial replacement must fail closed.
     const complete=integrationFields(provider).filter(f=>f.secret&&f.required).every(f=>String(replacements[f.key]||'').trim());
     if(!complete)throw error;
    }
   }
   const secrets={...previous,...Object.fromEntries(Object.entries(replacements).filter(([,v])=>String(v).trim()))};
   const identity=provider==='meta_ads'?'account_id':provider==='posthog'?'project_id':provider==='metricool'?'blog_id':provider==='google_ads'?'customer_id':null;
   if(row&&identity&&(body.config?.[identity]!==row.config[identity]||(provider==='posthog'&&body.config?.host!==row.config.host)||(provider==='metricool'&&body.config?.user_id!==row.config.user_id)||(provider==='google_ads'&&(body.config?.client_id!==row.config.client_id||body.config?.login_customer_id!==row.config.login_customer_id)))){
    const requiredSecret=provider==='meta_ads'?'access_token':provider==='google_ads'?'refresh_token':'api_key';
    if(!String(replacements[requiredSecret]||'').trim())throw new ApiError('Al cambiar de cuenta o proyecto externo debes introducir una nueva clave para esa conexión.',400);
    if(provider==='meta_ads'&&!String(replacements.write_token||'').trim())delete secrets.write_token;
   }
   let validated;try{validated=validateIntegration(provider,body.config,secrets);}catch(error){throw new ApiError(error instanceof Error?error.message:'Revisa los datos.',400);}
   const bound={workspace_id:body.workspace_id,project_id:project?.id||null,provider,config:validated.config};
   const envelope=sealSecrets(bound,validated.secrets);
   const saved=await client.rpc('save_integration',{p_workspace:body.workspace_id,p_project:project?.id||null,p_provider:provider,p_config:validated.config,p_fields:Object.keys(validated.secrets),p_envelope:envelope,p_expected:body.expected??null});
   if(saved.error)throw new ApiError('No se pudo guardar: la configuración puede haber cambiado. Actualiza y revisa los campos.',409);
   return NextResponse.json({saved:true},{headers});
  }
  if(!row)throw new ApiError('Guarda primero esta conexión.',400);
  if(body.expected!==row.updated_at)throw new ApiError('La configuración ha cambiado. Actualiza antes de continuar.',409);
  if(body.action==='verify'){
   if(!integrationCatalog[provider].testable)throw new ApiError('Este proveedor admite configuración privada; la comprobación API se añadirá con su integración.',400);
   const secrets=await connectionSecrets(client,row,project);
   const note=await verify(row,secrets);
   const saved=await client.rpc('set_integration_state',{p_id:row.id,p_expected:row.updated_at,p_enabled:true,p_note:note});
   if(saved.error)throw new ApiError('La conexión respondió, pero su configuración cambió. Actualiza y comprueba de nuevo.',409);
   return NextResponse.json({verified:true,note},{headers});
  }
  if(typeof body.enabled!=='boolean')throw new ApiError('Elige un estado válido.',400);
  const changed=await client.rpc('set_integration_state',{p_id:row.id,p_expected:row.updated_at,p_enabled:body.enabled});
  if(changed.error)throw new ApiError('No se pudo cambiar el estado. Actualiza los datos.',409);
  return NextResponse.json({changed:true},{headers});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo completar la configuración de Integraciones.'},{status:error instanceof ApiError?error.status:400,headers});}
}

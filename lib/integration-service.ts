import type {SupabaseClient} from '@supabase/supabase-js';
import type {Item} from './model';
import {type Connection,type IntegrationProvider,validateIntegration} from './integrations';
import {openSecrets} from './integration-secrets';
import {ApiError} from './server-access';
import {metaConnection} from './meta-ads';
import {verifiedPosthogConnection} from './posthog-connection';
export async function storedConnection(client:SupabaseClient,workspace:string,provider:IntegrationProvider,project:string|null){
 let query=client.from('integration_connections').select('*').eq('workspace_id',workspace).eq('provider',provider);
 query=project?query.eq('project_id',project):query.is('project_id',null);
 const result=await query.maybeSingle();if(result.error)throw new ApiError('No se pudo cargar la integración. Actualiza los datos.',503);
 return result.data as Connection|null;
}
export async function connectionSecrets(client:SupabaseClient,row:Connection,project?:Item):Promise<Record<string,string>>{
 if(!row.enabled)throw new ApiError('Esta integración está desactivada. Revísala en Integraciones.',503);
 if(row.source==='encrypted'){
  const result=await client.rpc('read_integration_envelope',{p_id:row.id});
  if(result.error||typeof result.data!=='string')throw new ApiError('No se pudo recuperar la conexión privada.',503);
  return validateIntegration(row.provider,row.config,openSecrets(row,result.data)).secrets;
 }
 if(row.provider==='openai')return {api_key:process.env.OPENAI_API_KEY||''};
 if(row.provider==='meta_ads'&&project){
  const connection=metaConnection(project);if(row.config.account_id!==connection.accountId)throw new ApiError('La cuenta de Meta necesita revisión en Integraciones.',409);
  return {access_token:connection.token,...(process.env.META_ADS_WRITE_ACCESS_TOKEN?{write_token:process.env.META_ADS_WRITE_ACCESS_TOKEN.trim()}: {})};
 }
 if(row.provider==='posthog'&&project){
  const verified=await verifiedPosthogConnection(client,project,process.env.POSTHOG_ALLOWED_HOSTS);
  if(row.config.project_id!==verified.projectId||row.config.host!==verified.host)throw new ApiError('La conexión de PostHog necesita revisión.',409);
  return {api_key:process.env.POSTHOG_PERSONAL_API_KEY||''};
 }
 throw new ApiError('La integración no tiene una conexión autorizada.',403);
}
export async function resolvedMetaConnection(client:SupabaseClient,project:Item){
 let row=await storedConnection(client,project.workspace_id,'meta_ads',project.id);
 // An explicit project connection (even disabled) takes precedence. Inheritance
 // requires an owner-selected encrypted connection in this exact workspace.
 if(!row){
  const shared=await client.from('integration_connections').select('*').eq('workspace_id',project.workspace_id).eq('provider','meta_ads').eq('workspace_default',true).eq('source','encrypted').maybeSingle();
  if(shared.error)throw new ApiError('No se pudo cargar la conexión compartida de Meta.',503);
  row=shared.data as Connection|null;
 }
 if(!row)throw new ApiError('Configura Meta Ads para este proyecto en Integraciones.',403);
 const secrets=await connectionSecrets(client,row,project);
 return {accountId:row.config.account_id,token:secrets.access_token,writeToken:secrets.write_token,pageId:row.config.page_id,instagramId:row.config.instagram_id,pixelId:row.config.pixel_id,revision:row.updated_at};
}
export async function resolvedOpenAIKey(client:SupabaseClient,workspace:string){
 const row=await storedConnection(client,workspace,'openai',null);
 if(!row)throw new ApiError('Configura OpenAI para este equipo en Integraciones.',503);
 const secrets=await connectionSecrets(client,row);if(!secrets.api_key)throw new ApiError('Falta la clave de OpenAI en Integraciones.',503);return secrets.api_key;
}
export async function resolvedPosthog(client:SupabaseClient,project:Item){
 const row=await storedConnection(client,project.workspace_id,'posthog',project.id);
 if(!row)throw new ApiError('Configura PostHog para este proyecto en Integraciones.',403);
 const secrets=await connectionSecrets(client,row,project);if(!secrets.api_key)throw new ApiError('Falta la clave de PostHog en Integraciones.',503);
 return {host:row.config.host,projectId:row.config.project_id,key:secrets.api_key};
}

export async function resolvedGoogleAds(client:SupabaseClient,project:Item){
 const row=await storedConnection(client,project.workspace_id,'google_ads',project.id);
 if(!row)throw new ApiError('Configura Google Ads para este proyecto en Integraciones.',403);
 const secrets=await connectionSecrets(client,row,project);
 return {customerId:row.config.customer_id,loginCustomerId:row.config.login_customer_id,clientId:row.config.client_id,clientSecret:secrets.client_secret,refreshToken:secrets.refresh_token,revision:row.updated_at};
}

export async function resolvedSmartlead(client:SupabaseClient,project:Item){
 const row=await storedConnection(client,project.workspace_id,'smartlead',project.id);
 if(!row)throw new ApiError('Configura Smartlead para este proyecto en Integraciones.',403);
 const secrets=await connectionSecrets(client,row,project);
 return {key:secrets.api_key,revision:row.updated_at};
}

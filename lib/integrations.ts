export type IntegrationField={key:string;label:string;secret?:boolean;required?:boolean;format?:'number'|'google_id'|'google_auth'|'host'|'json'|'pem'|'date';help?:string};
const token=(key:string,label:string,required=true):IntegrationField=>({key,label,secret:true,required});
const id=(key:string,label:string,required=true):IntegrationField=>({key,label,format:'number',required});
export const integrationCatalog={
 openai:{name:'OpenAI · Asistente de IA',scope:'workspace',capability:'Preparación con IA disponible. ChatGPT Plus no incluye el consumo de esta API.',docs:'https://platform.openai.com/api-keys',testable:true,fields:[token('api_key','Clave de OpenAI API')]},
 meta_ads:{name:'Meta Ads · Facebook e Instagram',scope:'workspace',capability:'Métricas de campañas, conjuntos y anuncios. Preparación revisada de imágenes, vídeos y anuncios pausados para web, alcance e interacción. Conversiones requieren un píxel con eventos configurados.',docs:'https://developers.facebook.com/docs/marketing-api/get-started/',testable:true,fields:[id('account_id','ID de cuenta publicitaria'),id('page_id','ID de página de Facebook',false),id('instagram_id','ID de cuenta de Instagram',false),id('pixel_id','ID del píxel / dataset de Meta',false),id('app_id','ID de aplicación de Meta',false),token('access_token','Token de lectura · ads_read'),token('write_token','Token de preparación · ads_management',false),{key:'expires_at',label:'Caducidad prevista del token',format:'date'}]},
 posthog:{name:'PostHog',scope:'workspace',capability:'Prepara borradores A/B desde un prompt, vincula su ID y consulta sus resultados. Las feature flags se crean desactivadas; la implementación y activación se revisan en PostHog.',docs:'https://posthog.com/docs/api/experiments',testable:true,fields:[id('project_id','ID de proyecto en PostHog'),{key:'host',label:'Región de PostHog',format:'host',required:true},token('api_key','Clave personal de PostHog API')]},
 google_ads:{name:'Google Ads',scope:'workspace',capability:'Consulta campañas y métricas. Prepara Búsqueda o Display con dos anuncios pausados y sus imágenes, validados antes de enviar. Conexión mediante cuenta de servicio u OAuth. Las cuentas reales requieren acceso Explorer o superior en Google Cloud.',docs:'https://developers.google.com/google-ads/api/docs/oauth/service-accounts',testable:true,fields:[{key:'customer_id',label:'ID de cuenta de Google Ads',format:'google_id',required:true,help:'Diez dígitos; aparece junto al nombre de tu cuenta en Google Ads.'},{key:'login_customer_id',label:'ID de cuenta administradora',format:'google_id',help:'Déjalo vacío si accedes directamente, sin una cuenta MCC.'},{key:'auth_method',label:'Método de conexión',format:'google_auth'},{...token('service_account','JSON privado de la cuenta de servicio',false),format:'json'}, {key:'client_id',label:'ID de cliente OAuth',help:'Cliente del proyecto Google Cloud aprobado para Google Ads API.'},token('client_secret','Secreto de cliente OAuth',false),{...token('refresh_token','Refresh token de OAuth',false),help:'Autorización de tu usuario de Google Ads para el alcance adwords.'},token('developer_token','Developer token antiguo · compatibilidad',false)]},
 metricool:{name:'Metricool',scope:'workspace',capability:'Consulta y vinculación de publicaciones con métricas para revisión. Creación de borradores en preparación. Requiere acceso API (Advanced o Custom).',docs:'https://app.metricool.com/resources/apidocs/index.html',testable:true,fields:[id('user_id','userId de Metricool'),id('blog_id','blogId de la marca'),token('api_key','Token API de Metricool')]},
 smartlead:{name:'Smartlead',scope:'workspace',capability:'Consulta y vinculación de campañas y resultados. Preparación de borradores A/B para revisión manual.',docs:'https://helpcenter.smartlead.ai/en/articles/125-full-api-documentation',testable:true,fields:[token('api_key','Clave API de Smartlead')]},
 linkedin_ads:{name:'LinkedIn Ads',scope:'workspace',capability:'Configuración privada preparada; conexión y monitorización API pendientes.',docs:'https://learn.microsoft.com/en-us/linkedin/marketing/',testable:false,fields:[id('account_id','ID de cuenta publicitaria'),token('access_token','Token de acceso de LinkedIn')]},
 tiktok_ads:{name:'TikTok Ads',scope:'workspace',capability:'Configuración privada preparada; conexión y monitorización API pendientes.',docs:'https://business-api.tiktok.com/portal/docs',testable:false,fields:[id('advertiser_id','ID de anunciante'),token('access_token','Token de acceso de TikTok')]},
 app_store:{name:'App Store Connect · iOS',scope:'workspace',capability:'Configuración privada preparada; operaciones API pendientes.',docs:'https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api',testable:false,fields:[{key:'issuer_id',label:'Issuer ID',required:true},{key:'key_id',label:'Key ID',required:true},id('app_id','ID de la app'),{...token('private_key','Clave privada de App Store Connect'),format:'pem'}]},
 google_play:{name:'Google Play · Android',scope:'workspace',capability:'Preparación de tests de la ficha y resultados manuales disponibles en Experimentos. La API pública no permite crear estos tests ni consultar sus resultados por variante. Las credenciales solo se necesitarán para futuras operaciones de publicación o Android Vitals.',docs:'https://developers.google.com/android-publisher/getting_started',testable:false,fields:[{key:'package_name',label:'Nombre del paquete · ej. com.empresa.app',required:true},{...token('service_account','JSON de la cuenta de servicio'),format:'json'}]},
} satisfies Record<string,{name:string;scope:string;capability:string;docs:string;testable:boolean;fields:IntegrationField[]}>;
export type IntegrationProvider=keyof typeof integrationCatalog;
export type Connection={id:string;workspace_id:string;project_id:string|null;provider:IntegrationProvider;config:Record<string,string>;source:'server'|'encrypted';secret_fields:string[];enabled:boolean;verified_at:string|null;verification_note:string;updated_at:string;workspace_default?:boolean};
export function integrationProvider(value:unknown):IntegrationProvider{
 if(typeof value!=='string'||!Object.hasOwn(integrationCatalog,value))throw new Error('Selecciona una integración válida.');return value as IntegrationProvider;
}
export function integrationFields(provider:IntegrationProvider):IntegrationField[]{return integrationCatalog[provider].fields;}
export function validateIntegration(provider:IntegrationProvider,config:unknown,secrets:unknown){
 if(!config||typeof config!=='object'||Array.isArray(config)||!secrets||typeof secrets!=='object'||Array.isArray(secrets))throw new Error('Revisa la configuración.');
 const fields=integrationFields(provider),allowed=(secret:boolean)=>fields.filter(f=>!!f.secret===secret).map(f=>f.key);
 if(Object.keys(config).some(k=>!allowed(false).includes(k))||Object.keys(secrets).some(k=>!allowed(true).includes(k)))throw new Error('La configuración incluye campos no admitidos.');
 const parsedConfig:Record<string,string>={},parsedSecrets:Record<string,string>={};
 for(const field of fields){
  const value=(field.secret?secrets:config) as Record<string,unknown>;const input=value[field.key]??'';
  if(typeof input!=='string')throw new Error(`Revisa ${field.label}.`);let raw=input.trim();
  if(field.required&&!raw)throw new Error(`Falta ${field.label}.`);
  if(!raw)continue;
  if(raw.length>(field.secret?30000:300)||(!['pem','json'].includes(field.format||'')&&/[\r\n\x00]/.test(raw)))throw new Error(`Revisa ${field.label}.`);
  if(field.format==='google_id')raw=raw.replace(/-/g,'');
  if(['number','google_id'].includes(field.format||'')&&!/^\d{1,30}$/.test(raw))throw new Error(`Usa un ID numérico en ${field.label}.`);
  if(field.format==='google_id'&&raw.length!==10)throw new Error(`El ID de Google Ads debe tener 10 dígitos.`);
  if(field.format==='host'&&!['https://us.posthog.com','https://eu.posthog.com','https://app.posthog.com'].includes(raw.replace(/\/$/,'')))throw new Error('Elige PostHog US o EU.');
  if(field.format==='host')raw=raw.replace(/\/$/,'');
  if(field.format==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||Number.isNaN(Date.parse(raw))||new Date(raw).toISOString().slice(0,10)!==raw))throw new Error('Revisa la caducidad.');
  if(field.format==='pem'&&!/^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----$/.test(raw))throw new Error('Introduce la clave privada PEM completa.');
  if(field.format==='json'){let parsed;try{parsed=JSON.parse(raw);}catch{throw new Error('El JSON de la cuenta de servicio no es válido.');}if(!parsed||parsed.type!=='service_account'||typeof parsed.client_email!=='string'||typeof parsed.private_key!=='string')throw new Error('El JSON debe pertenecer a una cuenta de servicio.');}
  if(provider==='openai'&&field.key==='api_key'&&!/^sk-[A-Za-z0-9_-]{15,}$/.test(raw))throw new Error('La clave de OpenAI API no es válida.');
  (field.secret?parsedSecrets:parsedConfig)[field.key]=raw;
 }
 if(provider==='google_ads'){
  const method=parsedConfig.auth_method||'oauth';
  if(!['oauth','service_account'].includes(method))throw new Error('Elige cuenta de servicio u OAuth para Google Ads.');
  if(method==='service_account'){
   if(!parsedSecrets.service_account)throw new Error('Falta el JSON privado de la cuenta de servicio.');
   const service=JSON.parse(parsedSecrets.service_account);
   if(!/^[-a-z0-9_.]+@[-a-z0-9.]+\.gserviceaccount\.com$/i.test(service.client_email)||!/^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----\s*$/.test(service.private_key))throw new Error('Usa el JSON privado original de una cuenta de servicio de Google Cloud.');
   delete parsedConfig.client_id;delete parsedSecrets.client_secret;delete parsedSecrets.refresh_token;
  }else{
   if(!parsedConfig.client_id||!parsedSecrets.client_secret||!parsedSecrets.refresh_token)throw new Error('Completa el ID de cliente OAuth, su secreto y el refresh token, o elige cuenta de servicio.');
   delete parsedSecrets.service_account;
  }
 }
 return {config:parsedConfig,secrets:parsedSecrets};
}

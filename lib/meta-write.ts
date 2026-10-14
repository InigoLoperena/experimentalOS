import {ApiError} from './server-access';
import {MetaCreationError} from './meta-preparation';
import {metaId,metaJson,type MetaConnection} from './meta-ads';
import {metaStepPayload,type MetaRecipe,type MetaStep,type MetaStepResult} from './meta-build';
export async function metaPost(connection:MetaConnection,edge:'campaigns'|'adsets'|'adcreatives'|'ads'|'adimages'|'advideos',body:URLSearchParams|FormData,fetcher:typeof fetch=fetch){
 metaId(connection.accountId);
 let response:Response;
 try{response=await fetcher(`https://${edge==='advideos'?'graph-video':'graph'}.facebook.com/v26.0/act_${connection.accountId}/${edge}`,{method:'POST',body,headers:{Authorization:`Bearer ${connection.token}`},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});}catch{throw new MetaCreationError('Meta no confirmó este paso. Revisa Ads Manager antes de repetir: podría haberse creado.',true);}
 let result:Record<string,unknown>;
 try{result=await response.json();}catch{throw new MetaCreationError('Meta devolvió una respuesta incompleta. Revisa Ads Manager.',true);}
 if(!result||typeof result!=='object'||Array.isArray(result))throw new MetaCreationError('Meta no confirmó el resultado.',true);
 if(!response.ok||result.error){
  const error=result.error as {code?:number;error_subcode?:number;error_user_msg?:string;error_user_title?:string};
  const code=Number.isSafeInteger(error?.code)?error.code:undefined,subcode=Number.isSafeInteger(error?.error_subcode)?error.error_subcode:undefined;
  console.warn('Meta preparation rejected',{status:response.status,code,subcode,edge});
  // Only the provider's user-facing explanation is retained. Never expose raw
  // OAuth messages, request payloads, token-bearing URLs or credentials.
  const clean=(value:unknown)=>typeof value==='string'?value.split(connection.token).join('[credencial omitida]').replace(/https?:\/\/[^\s<>]+/gi,'[enlace omitido]').replace(/\bBearer\s+\S+/gi,'[credencial omitida]').replace(/\b(?:access_token|appsecret_proof|authorization)\s*[:=]\s*[^\s,;]+/gi,'[credencial omitida]').replace(/\b[A-Za-z0-9_=-]{60,}\b/g,'[identificador omitido]').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,700):'';
  const explanation=[clean(error?.error_user_title),clean(error?.error_user_msg)].filter(Boolean).join(': ');
  const detail=code===190?'Renueva el token de Meta en Integraciones.':subcode===1885183?'Meta bloquea la creatividad porque su aplicación está en modo desarrollo. Revisa el modo en Meta for Developers.':subcode===1870227?'Meta exige indicar explícitamente la configuración de audiencia Advantage+. La preparación debe enviarla conservando la segmentación elegida.':explanation||([10,200].includes(code||0)?'La integración no tiene permiso para este recurso. Revisa su acceso en Integraciones.':'Meta no incluyó una explicación para el usuario. Consulta este código en Ads Manager.');
  throw new MetaCreationError(`Meta rechazó ${edge} (${code||response.status}${subcode?`/${subcode}`:''}): ${detail} Los pasos confirmados están guardados; continúa esta preparación después de resolver la causa.`,response.status>=500||!result.error,{code,subcode,detail});
 }
 return result;
}
export async function writeMetaStep(connection:MetaConnection,recipe:MetaRecipe,step:MetaStep,results:Record<string,MetaStepResult>,file?:Buffer,fetcher:typeof fetch=fetch):Promise<MetaStepResult>{
 if(['image','thumbnail'].includes(step.kind)){
  if(!file)throw new ApiError('Falta la imagen revisada.',400);
  const response=await metaPost(connection,'adimages',new URLSearchParams({bytes:file.toString('base64')}),fetcher);
  const images=response.images as Record<string,{hash?:unknown}>|undefined,values=images&&Object.values(images);
  if(!values||values.length!==1||typeof values[0].hash!=='string'||! /^[a-f0-9]{32}$/.test(values[0].hash))throw new MetaCreationError('Meta no confirmó el hash de la imagen.',true);
  return {hash:values[0].hash};
 }
 if(step.kind==='video'){
  if(!file||file.length<12||file.subarray(4,8).toString()!=='ftyp')throw new ApiError('El archivo no es un vídeo MP4 válido.',400);
  const body=new FormData();body.append('source',new Blob([new Uint8Array(file)],{type:'video/mp4'}),'creative.mp4');body.append('title',step.label);
  const result=await metaPost(connection,'advideos',body,fetcher);if(typeof result.id!=='string'||! /^\d{1,30}$/.test(result.id))throw new MetaCreationError('Meta no confirmó el ID del vídeo.',true);return {id:result.id};
 }
 const payload=metaStepPayload(recipe,step,results);
 if(['campaign','adset','ad'].includes(step.kind)&&('status' in payload&&payload.status!=='PAUSED'))throw new ApiError('Solo se pueden crear recursos pausados.',400);
 const body=new URLSearchParams(Object.entries(payload).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):String(v)]));
 const edge={campaign:'campaigns',adset:'adsets',creative:'adcreatives',ad:'ads'} as const;
 const result=await metaPost(connection,edge[step.kind as keyof typeof edge],body,fetcher);
 if(typeof result.id!=='string'||! /^\d{1,30}$/.test(result.id))throw new MetaCreationError('Meta no confirmó el identificador del recurso.',true);
 return {id:result.id};
}
export async function metaVideoReady(connection:MetaConnection,id:string,fetcher:typeof fetch=fetch){
 const row=await metaJson(metaId(id),{fields:'status'},connection.token,fetcher);
 const status=(row.status as {video_status?:string})?.video_status;
 if(status==='error')throw new ApiError('Meta no pudo procesar el vídeo. Comprueba su formato en Ads Manager.',400);
 return status==='ready';
}

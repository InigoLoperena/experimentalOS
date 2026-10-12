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
 if(!response.ok||result.error){const error=result.error as {code?:number;error_subcode?:number;error_user_msg?:string;error_user_title?:string};console.warn('Meta preparation rejected',{status:response.status,code:error?.code,subcode:error?.error_subcode});const developmentMode=error?.error_subcode===1885183&&/development mode/i.test(`${error.error_user_title||''} ${error.error_user_msg||''}`);throw new MetaCreationError(error?.code===190?'Renueva el token de Meta en Integraciones.':developmentMode?'Meta bloquea la creatividad porque su aplicación está en modo desarrollo (100/1885183). Revisa el modo de la aplicación en Meta for Developers. Después continúa esta preparación guardada: los recursos ya confirmados no se repetirán.':`Meta rechazó el paso (código ${error?.code||response.status}${error?.error_subcode?`/${error.error_subcode}`:''}). Revisa permisos, identidad, presupuesto mínimo y compatibilidad del objetivo en Ads Manager.`,response.status>=500||!result.error);}
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

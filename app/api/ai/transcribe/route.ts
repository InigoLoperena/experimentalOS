import {NextResponse} from 'next/server';
import {authenticatedClient,authorizedProject,authorizedWorkspace,ApiError} from '@/lib/server-access';
import {resolvedOpenAIKey} from '@/lib/integration-service';
import {boundedVoiceForm,validateVoiceWav,voiceModel,voiceMaxBytes} from '@/lib/voice-audio';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){
 try{
  const {client}=await authenticatedClient(request);
  let form:FormData;try{form=await boundedVoiceForm(request);}catch(error){throw new ApiError(error instanceof Error?error.message:'No se pudo leer la grabación.',400);}
  const projectId=form.get('project_id'),requestId=form.get('request_id'),purpose=form.get('purpose'),file=form.get('audio');
  if(typeof projectId!=='string'||typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)||!['chat','experiment'].includes(String(purpose))||!(file instanceof File)||file.size>voiceMaxBytes)throw new ApiError('Revisa la grabación y el proyecto seleccionado.',400);
  const project=projectId?await authorizedProject(client,projectId):null;
  if(purpose==='experiment'&&!project)throw new ApiError('Selecciona el proyecto del experimento.',400);
  const workspace=project?.workspace_id||(await authorizedWorkspace(client,form.get('workspace_id'))).id;
  if(purpose==='experiment'){
   const [create,edit]=await Promise.all(['create','edit'].map(a=>client.rpc('can_record_action',{w:workspace,k:'experiment',a})));
   if(create.error||edit.error)throw new ApiError('No se pudieron comprobar tus permisos.',503);
   if(!create.data&&!edit.data)throw new ApiError('No tienes permiso para preparar experimentos.',403);
  }
  let seconds:number;try{seconds=validateVoiceWav(new Uint8Array(await file.arrayBuffer())).seconds;}catch(error){throw new ApiError(error instanceof Error?error.message:'La grabación no es válida.',400);}
  const key=await resolvedOpenAIKey(client,workspace);
  if(!key?.startsWith('sk-'))throw new ApiError('Configura OpenAI en Integraciones para transcribir el audio.',503);
  const reserved=await client.rpc('reserve_ai_transcription',{p_workspace:workspace,p_request:requestId});
  if(reserved.error)throw new ApiError(reserved.error.message,429);
  const input=new FormData();input.set('file',file,'dictado.wav');input.set('model',voiceModel);input.set('response_format','json');
  input.set('prompt',`Xperiments, Experimental OS, ${project?.title.slice(0,200)||'equipo de experimentación'}, Meta Ads, Google Ads, Metricool, Smartlead, Supabase, PostHog, test A/B.`);
  const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(35000),request.signal]),headers:{Authorization:`Bearer ${key}`},body:input});
  if(response.status===401||response.status===403)throw new ApiError('La conexión de OpenAI no tiene acceso a la transcripción. Revisa la clave y sus permisos en Integraciones.',503);
  if(!response.ok)throw new ApiError(response.status===429?'OpenAI ha alcanzado su saldo o límite de uso.':'OpenAI no pudo transcribir el audio. Puedes volver a intentarlo.',502);
  const result=await response.json();
  if(typeof result.text!=='string'||!result.text.trim())throw new ApiError('No se ha reconocido texto. Habla cerca del micrófono y vuelve a grabar.',422);
  if(result.text.length>12000)throw new ApiError('La transcripción es demasiado larga. Graba un audio más corto.',422);
  return NextResponse.json({text:result.text.trim(),seconds,reserved_usd:Number(reserved.data),monthly_limit_usd:5},{headers});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo transcribir el audio. Tus textos no se han modificado.'},{status:error instanceof ApiError?error.status:502,headers});}
}

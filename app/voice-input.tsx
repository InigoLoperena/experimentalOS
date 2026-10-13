'use client';
import {useEffect,useRef,useState} from 'react';
import {Mic,Square,X,LoaderCircle,RotateCcw} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {appendDictation,encodeVoiceWav} from '@/lib/voice-audio';
import {VoiceRecorder,browserRecorderDependencies,type VoicePhase} from '@/lib/voice-recorder';

type Props={projectId:string|null;purpose:'chat'|'experiment';value:string;onChange:(value:string)=>void;maxLength:number;disabled?:boolean;onBusy?:(busy:boolean)=>void;label?:string};
export function VoiceInput(props:Props){
 const [phase,setPhase]=useState<VoicePhase>('idle'),[seconds,setSeconds]=useState(0),[available,setAvailable]=useState<boolean|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[pendingText,setPendingText]=useState(''),[retry,setRetry]=useState(false);
 const settings=useRef(props),recorder=useRef<VoiceRecorder|null>(null),upload=useRef<AbortController|null>(null),generation=useRef(0),clip=useRef<Blob|null>(null),reportedBusy=useRef(false),mounted=useRef(false);
 useEffect(()=>{settings.current=props;});
 function changePhase(value:VoicePhase){
  if(!mounted.current)return;setPhase(value);const busy=value!=='idle';
  if(reportedBusy.current!==busy){reportedBusy.current=busy;settings.current.onBusy?.(busy);}
 }
 useEffect(()=>{
  mounted.current=true;
  const supported=window.isSecureContext&&!!navigator.mediaDevices?.getUserMedia&&typeof MediaRecorder!=='undefined'&&typeof AudioContext!=='undefined';setAvailable(supported);
  if(supported)recorder.current=new VoiceRecorder(browserRecorderDependencies(),{onPhase:changePhase,onTime:setSeconds,onClip:audio=>{clip.current=audio;void transcribe(audio);},onError:message=>{if(mounted.current)setError(message);}});
  return()=>{mounted.current=false;generation.current++;recorder.current?.dispose();recorder.current=null;upload.current?.abort();clip.current=null;if(reportedBusy.current){reportedBusy.current=false;settings.current.onBusy?.(false);}};
 },[]);
 function cancel(){generation.current++;upload.current?.abort();upload.current=null;recorder.current?.cancel();clip.current=null;setRetry(false);setPendingText('');setError('');setNotice(phase==='transcribing'?'Dictado descartado. El texto no se añadirá.':'Grabación cancelada.');changePhase('idle');}
 async function transcribe(audio:Blob){
  const current=++generation.current,abort=new AbortController();upload.current=abort;changePhase('transcribing');setRetry(false);setError('');setNotice('');
  try{
   const context=new AudioContext();let bytes:Uint8Array;
   try{const decoded=await context.decodeAudioData(await audio.arrayBuffer());bytes=encodeVoiceWav(decoded);}finally{if(context.state!=='closed')await context.close().catch(()=>{});}
   if(!mounted.current||current!==generation.current)return;
   const {data}=await supabase!.auth.getSession();if(!data.session)throw new Error('Inicia sesión para dictar.');
   const form=new FormData();form.set('project_id',settings.current.projectId||'');form.set('request_id',crypto.randomUUID());form.set('purpose',settings.current.purpose);form.set('audio',new Blob([new Uint8Array(bytes)],{type:'audio/wav'}),'dictado.wav');
   const response=await fetch('/api/ai/transcribe',{method:'POST',signal:abort.signal,headers:{Authorization:`Bearer ${data.session.access_token}`},body:form});
   let result;try{result=await response.json();}catch{throw new Error('El servicio de transcripción no respondió correctamente. Puedes volver a intentarlo.');}
   if(!response.ok)throw new Error(result.error||'No se pudo transcribir el audio.');
   if(!mounted.current||current!==generation.current)return;
   if(typeof result.text!=='string')throw new Error('No se ha recibido una transcripción válida.');
   clip.current=null;
   try{settings.current.onChange(appendDictation(settings.current.value,result.text,settings.current.maxLength));setNotice('Transcripción añadida. Revisa el texto antes de enviarlo.');}catch(err){setPendingText(result.text);setError(err instanceof Error?err.message:'Acorta el texto antes de añadirlo.');}
  }catch(err){if(mounted.current&&current===generation.current&&!abort.signal.aborted){setError(err instanceof TypeError?'No se pudo conectar para transcribir. Comprueba tu conexión y vuelve a intentarlo.':err instanceof DOMException?'No se pudo leer el audio en este navegador. Vuelve a grabar o utiliza otro navegador.':err instanceof Error?err.message:'No se pudo transcribir. Vuelve a intentarlo.');setRetry(!!clip.current);}}
  finally{if(mounted.current&&current===generation.current){upload.current=null;changePhase('idle');}}
 }
 function addPending(){try{settings.current.onChange(appendDictation(settings.current.value,pendingText,settings.current.maxLength));setPendingText('');setError('');setNotice('Transcripción añadida. Revisa el texto antes de enviarlo.');}catch(err){setError(err instanceof Error?err.message:'Revisa la transcripción.');}}
 const locked=props.disabled||!props.projectId||!supabase||available!==true;
 return <div className="voice-input">
  <div className="voice-controls">
   {phase==='idle'?<button type="button" className="btn voice-mic" aria-label={props.label||'Grabar audio para dictar'} title="Grabar audio para convertirlo en texto" disabled={locked||props.value.length>=props.maxLength||!!pendingText} onClick={()=>{setError('');setNotice('');clip.current=null;setRetry(false);void recorder.current?.start();}}><Mic size={18}/><span>Dictar</span></button>:phase==='recording'?<button type="button" className="btn voice-stop" onClick={()=>recorder.current?.stop()} aria-label="Terminar grabación y transcribir"><Square size={16}/><span>Terminar y transcribir</span></button>:<span className="voice-progress" role="status"><LoaderCircle size={17} className="voice-spinner"/>{phase==='requesting'?'Esperando permiso del micrófono…':'Transcribiendo…'}</span>}
   {phase==='recording'&&<span className="voice-timer" role="timer" aria-label={`${seconds} segundos grabados`}><span aria-hidden="true" className="voice-dot"/> {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} / 1:30</span>}
   {phase!=='idle'&&<button type="button" className="btn" onClick={cancel} aria-label="Cancelar dictado"><X size={16}/>Cancelar</button>}
   {retry&&phase==='idle'&&<button type="button" className="btn" disabled={props.disabled} onClick={()=>{if(clip.current)void transcribe(clip.current);}}><RotateCcw size={16}/>Reintentar transcripción</button>}
   {(retry||pendingText)&&phase==='idle'&&<button type="button" className="btn" onClick={cancel}>Descartar dictado</button>}
  </div>
  <small className="muted">Hasta 90 segundos. Al terminar, el audio se envía a OpenAI para transcribirlo y no se guarda en Xperiments. Cada transcripción reserva 0,03 USD del límite de IA del equipo.</small>
  {available===false&&<p className="small">Tu navegador no permite grabar aquí. Abre la aplicación con HTTPS en un navegador compatible; puedes seguir escribiendo.</p>}
  {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="small voice-notice" role="status">{notice}</p>}
  {pendingText&&<div className="voice-review"><label>Revisa o acorta la transcripción<textarea rows={4} value={pendingText} onChange={event=>setPendingText(event.target.value)}/></label><button type="button" className="btn" disabled={!pendingText.trim()||props.disabled} onClick={addPending}>Añadir texto</button></div>}
 </div>;
}

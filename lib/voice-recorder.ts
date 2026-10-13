import {voiceMaxSeconds} from './voice-audio';
export type VoicePhase='idle'|'requesting'|'recording'|'transcribing';
type Recorder=Pick<MediaRecorder,'state'|'mimeType'|'start'|'stop'|'ondataavailable'|'onstop'|'onerror'>;
type Callbacks={onPhase:(phase:VoicePhase)=>void;onTime:(seconds:number)=>void;onClip:(clip:Blob)=>void;onError:(message:string)=>void};
export type RecorderDependencies={getStream:()=>Promise<MediaStream>;createRecorder:(stream:MediaStream)=>Recorder};
export function microphoneError(error:unknown){
 const name=error&&typeof error==='object'&&'name' in error?String(error.name):'';
 if(name==='NotAllowedError'||name==='SecurityError')return 'Permite el micrófono en tu navegador para dictar. Puedes seguir escribiendo mientras tanto.';
 if(name==='NotFoundError')return 'No se ha encontrado un micrófono conectado.';
 if(name==='NotReadableError')return 'No se pudo abrir el micrófono. Comprueba si otra aplicación lo está utilizando.';
 return 'No se pudo grabar el audio. Revisa el micrófono y vuelve a intentarlo.';
}
export function browserRecorderDependencies():RecorderDependencies{
 return {getStream:()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false}),createRecorder:stream=>{
  const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
  return new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:64000}:undefined);
 }};
}
export class VoiceRecorder{
 private generation=0;private disposed=false;private active=false;private stream:MediaStream|null=null;private recorder:Recorder|null=null;private chunks:Blob[]=[];
 private timer:ReturnType<typeof setTimeout>|null=null;private ticker:ReturnType<typeof setInterval>|null=null;
 constructor(private dependencies:RecorderDependencies,private callbacks:Callbacks){}
 private release(){if(this.timer)clearTimeout(this.timer);if(this.ticker)clearInterval(this.ticker);this.timer=null;this.ticker=null;this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;}
 async start(){
  if(this.active||this.disposed)return;
  const generation=++this.generation;this.active=true;this.callbacks.onTime(0);this.callbacks.onPhase('requesting');
  try{
   const stream=await this.dependencies.getStream();if(this.disposed||generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return;}
   this.stream=stream;const recorder=this.dependencies.createRecorder(stream);this.recorder=recorder;this.chunks=[];let size=0;
   recorder.ondataavailable=event=>{if(generation!==this.generation||!event.data.size)return;size+=event.data.size;if(size>4*1024*1024){this.cancel();this.callbacks.onError('La grabación es demasiado grande. Graba un audio más corto.');return;}this.chunks.push(event.data);};
   recorder.onerror=()=>{if(generation===this.generation){this.cancel();this.callbacks.onError('La grabación se interrumpió. Vuelve a intentarlo.');}};
   recorder.onstop=()=>{
    if(this.disposed||generation!==this.generation)return;this.release();
    this.recorder=null;this.active=false;const clip=new Blob(this.chunks,{type:recorder.mimeType||'audio/webm'});this.chunks=[];
    if(!clip.size){this.callbacks.onPhase('idle');this.callbacks.onError('La grabación está vacía. Vuelve a intentarlo.');return;}
    this.callbacks.onPhase('transcribing');this.callbacks.onClip(clip);
   };
   recorder.start(1000);this.callbacks.onPhase('recording');const started=Date.now();
   this.ticker=setInterval(()=>this.callbacks.onTime(Math.min(voiceMaxSeconds,Math.floor((Date.now()-started)/1000))),500);
   this.timer=setTimeout(()=>this.stop(),voiceMaxSeconds*1000);
  }catch(error){if(generation===this.generation&&!this.disposed){this.cancel();this.callbacks.onError(microphoneError(error));}}
 }
 stop(){if(this.recorder?.state==='recording'){this.callbacks.onPhase('transcribing');this.recorder.stop();this.release();}}
 cancel(notify=true){++this.generation;const recorder=this.recorder;this.recorder=null;this.active=false;this.chunks=[];if(recorder&&recorder.state!=='inactive')recorder.stop();this.release();if(notify&&!this.disposed)this.callbacks.onPhase('idle');}
 dispose(){this.disposed=true;this.cancel(false);}
}

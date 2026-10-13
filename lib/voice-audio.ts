export const voiceSampleRate=16000;
export const voiceMaxSeconds=90;
export const voiceMaxBytes=44+voiceSampleRate*voiceMaxSeconds*2;
export const voiceUploadMaxBytes=voiceMaxBytes+65536;
export const voiceModel='gpt-4o-mini-transcribe-2025-12-15';

export function appendDictation(current:string,transcript:string,maxLength:number){
 const text=transcript.trim();if(!text)throw new Error('No se ha detectado texto en el audio. Vuelve a intentarlo.');
 const next=current.trimEnd()+(current.trim()?'\n':'')+text;
 if(next.length>maxLength)throw new Error(`El texto supera el límite de ${maxLength.toLocaleString('es')} caracteres. Acorta la transcripción antes de añadirla.`);
 return next;
}

type DecodedAudio=Pick<AudioBuffer,'numberOfChannels'|'sampleRate'|'length'|'duration'|'getChannelData'>;
export function encodeVoiceWav(audio:DecodedAudio):Uint8Array{
 if(!Number.isFinite(audio.duration)||audio.duration<0.5||audio.duration>voiceMaxSeconds+2||audio.numberOfChannels<1||audio.numberOfChannels>8||!Number.isFinite(audio.sampleRate)||audio.sampleRate<8000||audio.sampleRate>192000)throw new Error('Graba entre medio segundo y 90 segundos de audio.');
 const channels=Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i));
 if(channels.some(channel=>channel.length<audio.length))throw new Error('No se pudo leer la grabación.');
 const frames=Math.min(Math.floor(audio.duration*voiceSampleRate),voiceMaxSeconds*voiceSampleRate);
 const bytes=new Uint8Array(44+frames*2),view=new DataView(bytes.buffer);
 const tag=(offset:number,text:string)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
 tag(0,'RIFF');view.setUint32(4,bytes.length-8,true);tag(8,'WAVE');tag(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,voiceSampleRate,true);view.setUint32(28,voiceSampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);tag(36,'data');view.setUint32(40,frames*2,true);
 const ratio=audio.sampleRate/voiceSampleRate;
 for(let i=0;i<frames;i++){
  const position=i*ratio,lo=Math.min(Math.floor(position),audio.length-1),hi=Math.min(lo+1,audio.length-1),fraction=position-lo;
  let value=0;for(const channel of channels)value+=channel[lo]*(1-fraction)+channel[hi]*fraction;
  value=Math.max(-1,Math.min(1,value/channels.length));view.setInt16(44+i*2,Math.round(value*(value<0?32768:32767)),true);
 }
 validateVoiceWav(bytes);return bytes;
}

// Only the bounded PCM shape produced by our recorder is accepted. Duration is derived
// from validated sample bytes, never trusted from browser metadata or the filename.
export function validateVoiceWav(bytes:Uint8Array){
 if(bytes.length<44+voiceSampleRate||bytes.length>voiceMaxBytes||bytes.length%2)throw new Error('Graba entre medio segundo y 90 segundos de audio.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const tag=(offset:number,size:number)=>String.fromCharCode(...bytes.subarray(offset,offset+size));
 if(tag(0,4)!=='RIFF'||tag(8,4)!=='WAVE'||tag(12,4)!=='fmt '||tag(36,4)!=='data'||view.getUint32(4,true)!==bytes.length-8||view.getUint32(16,true)!==16||view.getUint16(20,true)!==1||view.getUint16(22,true)!==1||view.getUint32(24,true)!==voiceSampleRate||view.getUint32(28,true)!==voiceSampleRate*2||view.getUint16(32,true)!==2||view.getUint16(34,true)!==16||view.getUint32(40,true)!==bytes.length-44)throw new Error('El formato de la grabación no es válido. Graba de nuevo con el micrófono.');
 let energy=0,peak=0;const samples=(bytes.length-44)/2;
 for(let i=44;i<bytes.length;i+=2){const value=view.getInt16(i,true)/32768;energy+=value*value;peak=Math.max(peak,Math.abs(value));}
 if(Math.sqrt(energy/samples)<0.001||peak<0.005)throw new Error('El audio está vacío o demasiado bajo. Revisa el micrófono y vuelve a grabar.');
 return {seconds:samples/voiceSampleRate};
}

export async function boundedVoiceForm(request:Request){
 const contentType=request.headers.get('content-type')||'';
 if(!contentType.startsWith('multipart/form-data;'))throw new Error('Envía la grabación con el botón de micrófono.');
 if(Number(request.headers.get('content-length')||0)>voiceUploadMaxBytes)throw new Error('La grabación es demasiado grande.');
 const reader=request.body?.getReader();if(!reader)throw new Error('La grabación está vacía.');
 let total=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>voiceUploadMaxBytes){await reader.cancel();throw new Error('La grabación es demasiado grande.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return new Response(bytes,{headers:{'Content-Type':contentType}}).formData();
}

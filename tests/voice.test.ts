import test from 'node:test';
import assert from 'node:assert/strict';
import {appendDictation,encodeVoiceWav,validateVoiceWav,voiceMaxBytes,voiceUploadMaxBytes,boundedVoiceForm} from '../lib/voice-audio';
import {VoiceRecorder,microphoneError,type RecorderDependencies} from '../lib/voice-recorder';

export function sampleAudio(seconds=1,rate=48000){
 const data=Float32Array.from({length:Math.floor(seconds*rate)},(_,i)=>0.2*Math.sin(i*2*Math.PI*440/rate));
 return {duration:seconds,sampleRate:rate,length:data.length,numberOfChannels:2,getChannelData:()=>data};
}
test('dictation WAV is mono 16 kHz, duration-bounded and rejects silence, forged metadata and excess duration',()=>{
 const wav=encodeVoiceWav(sampleAudio());assert.equal(wav.length,32044);assert.equal(validateVoiceWav(wav).seconds,1);
 const forged=wav.slice();new DataView(forged.buffer).setUint32(40,32,true);assert.throws(()=>validateVoiceWav(forged),/formato/);
 const stereo=wav.slice();new DataView(stereo.buffer).setUint16(22,2,true);assert.throws(()=>validateVoiceWav(stereo),/formato/);
 const silence=wav.slice();silence.fill(0,44);assert.throws(()=>validateVoiceWav(silence),/vacío o demasiado bajo/);
 assert.throws(()=>validateVoiceWav(new Uint8Array(voiceMaxBytes+2)),/90 segundos/);
 assert.throws(()=>encodeVoiceWav(sampleAudio(0.2)),/90 segundos/);
 assert.throws(()=>encodeVoiceWav({...sampleAudio(),duration:300}),/90 segundos/);
});
test('voice text appends without overwriting typed text, preserves languages and refuses silent truncation',()=>{
 assert.equal(appendDictation('Texto escrito.','  Diseña un A/B.  ',100),'Texto escrito.\nDiseña un A/B.');
 assert.equal(appendDictation('','Create a campaign in English.',100),'Create a campaign in English.');
 assert.throws(()=>appendDictation('Existing text','Too much dictated text',15),/límite/);
 assert.throws(()=>appendDictation('Old','  ',20),/texto/);
});
test('multipart audio is bounded even when content-length is missing or false',async()=>{
 const request=new Request('https://app.test',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=x'},body:new Uint8Array(voiceUploadMaxBytes+1)});
 await assert.rejects(boundedVoiceForm(request),/demasiado grande/);
 await assert.rejects(boundedVoiceForm(new Request('https://app.test',{method:'POST',body:'bad'})),/micrófono/);
});
test('cancelling while microphone permission is pending releases the eventual stream and never starts recording',async()=>{
 let deliver!:(stream:MediaStream)=>void,stopped=0,created=0,clips=0;
 const stream={getTracks:()=>[{stop:()=>stopped++}]} as unknown as MediaStream;
 const recorder=new VoiceRecorder({getStream:()=>new Promise(resolve=>{deliver=resolve;}),createRecorder:()=>{created++;throw new Error();}},{onPhase:()=>{},onTime:()=>{},onClip:()=>clips++,onError:()=>{}});
 const start=recorder.start();recorder.cancel();deliver(stream);await start;assert.equal(stopped,1);assert.equal(created,0);assert.equal(clips,0);recorder.dispose();
});
test('stopping yields one clip and releases the microphone; stale stop events cannot stop a new recording',async()=>{
 let stopped=0,clips=0;const instances:any[]=[],phases:string[]=[];
 const dependencies:RecorderDependencies={getStream:async()=>({getTracks:()=>[{stop:()=>stopped++}]} as unknown as MediaStream),createRecorder:()=>{
  const fake:any={state:'inactive',mimeType:'audio/webm',ondataavailable:null,onstop:null,onerror:null,start(){this.state='recording';},stop(){this.state='inactive';}};instances.push(fake);return fake;
 }};
 const recorder=new VoiceRecorder(dependencies,{onPhase:phase=>phases.push(phase),onTime:()=>{},onClip:()=>clips++,onError:()=>{}});
 await recorder.start();recorder.cancel();await recorder.start();assert.equal(stopped,1);instances[0].onstop();assert.equal(stopped,1);
 instances[1].ondataavailable({data:new Blob(['voice'])});recorder.stop();assert.equal(stopped,2);instances[1].onstop();assert.equal(clips,1);assert.equal(stopped,2);assert.equal(phases.at(-1),'transcribing');recorder.dispose();
});
test('microphone permission failures are understandable and expose no provider or device details',()=>{
 assert.match(microphoneError({name:'NotAllowedError',message:'secret-device-name'}),/Permite el micrófono/);
 assert.doesNotMatch(microphoneError(new Error('secret')),/secret/);
});

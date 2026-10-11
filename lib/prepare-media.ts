import {attachmentFileType} from './attachments';
import {validateAiMedia,type AiMedia} from './ai-media';

function event(target:HTMLVideoElement,name:string):Promise<void>{
  return new Promise((resolve,reject)=>{const done=()=>{clearTimeout(timer);target.removeEventListener(name,ok);target.removeEventListener('error',fail);};const ok=()=>{done();resolve();};const fail=()=>{done();reject(new Error('No se pudo leer el vídeo. Usa MP4 o WebM compatible con el navegador.'));};const timer=setTimeout(fail,10000);target.addEventListener(name,ok,{once:true});target.addEventListener('error',fail,{once:true});});
}
function frame(source:CanvasImageSource,width:number,height:number){
  const canvas=document.createElement('canvas');const factor=Math.min(1,768/Math.max(width,height));canvas.width=Math.max(1,Math.round(width*factor));canvas.height=Math.max(1,Math.round(height*factor));
  const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar la imagen.');context.drawImage(source,0,0,canvas.width,canvas.height);let data=canvas.toDataURL('image/jpeg',0.7);if(data.length>260000)data=canvas.toDataURL('image/jpeg',0.35);return data;
}
export async function prepareMedia(files:File[]):Promise<AiMedia[]>{
  const result:AiMedia[]=[];
  for(const file of files){
    const type=attachmentFileType(file);
    if(type.kind==='image'){
      const image=await createImageBitmap(file);
      try{result.push({name:file.name,kind:'image',data:frame(image,image.width,image.height),timestamp:null});}finally{image.close();}
    }else if(type.kind==='video'){
      const url=URL.createObjectURL(file);const video=document.createElement('video');video.preload='auto';video.muted=true;video.playsInline=true;
      try{
        const loaded=event(video,'loadeddata');video.src=url;await loaded;
        if(!Number.isFinite(video.duration)||video.duration>180)throw new Error('Para preparar con IA, usa vídeos de hasta tres minutos.');
        for(let index=0;index<4;index++){
          const time=(video.duration*index)/4;
          if(Math.abs(video.currentTime-time)>0.01){const sought=event(video,'seeked');video.currentTime=time;await sought;}
          result.push({name:file.name,kind:'video_frame',data:frame(video,video.videoWidth,video.videoHeight),timestamp:time});
        }
      }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
    }
  }
  return validateAiMedia(result);
}

'use client';
import {useEffect,useRef,useState,type ChangeEvent,type DragEvent,type KeyboardEvent} from 'react';
import {Paperclip,Send,X} from 'lucide-react';
import {VoiceInput} from './voice-input';
import {chatFileAccept,experimentFileAccept,validatePromptFiles} from '@/lib/ai-prompt-files';

type Props={
 id:string;projectId:string|null;workspaceId?:string;purpose:'chat'|'experiment';
 value:string;onChange:(next:string)=>void;maxLength?:number;
 disabled:boolean;voiceBusy:boolean;onVoiceBusy:(active:boolean)=>void;
 files:File[];onFiles:(next:File[])=>void;
 onSubmit:()=>void;busy:boolean;placeholder:string;allowFiles?:boolean;
};
export function AIPromptComposer({id,projectId,workspaceId,purpose,value,onChange,maxLength,disabled,voiceBusy,onVoiceBusy,files,onFiles,onSubmit,busy,placeholder,allowFiles=true}:Props){
 const textarea=useRef<HTMLTextAreaElement|null>(null);
 const picker=useRef<HTMLInputElement|null>(null);
 const [dragging,setDragging]=useState(false);
 const [error,setError]=useState('');
 const canUse=!disabled&&!busy&&!voiceBusy;
 useEffect(()=>{
  const el=textarea.current;if(!el)return;
  el.style.height='54px';el.style.height=Math.min(200,Math.max(54,el.scrollHeight))+'px';
  el.style.overflowY=el.scrollHeight>200?'auto':'hidden';
 },[value]);
 function add(filesToAdd:File[]){
  if(!allowFiles||!canUse||!filesToAdd.length)return;
  try{
   const combined=[...files,...filesToAdd];
   validatePromptFiles(combined,purpose);
   onFiles(combined);setError('');
  }catch(e){setError(e instanceof Error?e.message:'No se pueden adjuntar estos archivos.');}
 }
 function onDrop(e:DragEvent<HTMLDivElement>){e.preventDefault();e.stopPropagation();setDragging(false);add(Array.from(e.dataTransfer.files));}
 function onDragOver(e:DragEvent<HTMLDivElement>){e.preventDefault();if(allowFiles&&!disabled)setDragging(true);}
 function send(){if(canUse&&(value.trim()||files.length>0))onSubmit();}
 function keyDown(event:KeyboardEvent<HTMLTextAreaElement>){if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send();}}
 function selectFile(event:ChangeEvent<HTMLInputElement>){add(Array.from(event.target.files||[]));event.target.value='';}
 return <div className={`ai-prompt-composer ${dragging?'ai-dragging':''}`} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false);}}>
  {files.length>0&&<div className="ai-file-list" aria-label="Archivos adjuntos">{files.map((file,index)=><span className="ai-file-chip" key={index} title={file.name}><Paperclip size={13}/><span>{file.name}</span><button type="button" disabled={!canUse} aria-label={`Quitar ${file.name}`} onClick={()=>{onFiles(files.filter((_,i)=>i!==index));setError('');}}><X size={13}/></button></span>)}</div>}
  <div className="ai-compose-line">
   {allowFiles&&<><input ref={picker} className="sr-only" type="file" multiple accept={purpose==='chat'?chatFileAccept:experimentFileAccept} aria-label="Seleccionar archivos para adjuntar" onChange={selectFile} disabled={!canUse}/><button type="button" className="ai-attach-button" onClick={()=>picker.current?.click()} disabled={!canUse} title="Adjuntar archivos o arrastrarlos aquí" aria-label="Adjuntar archivos"><Paperclip size={19}/></button></>}
   <label className="sr-only" htmlFor={id}>Escribe tu mensaje para la IA</label>
   <textarea ref={textarea} id={id} rows={1} maxLength={maxLength} value={value} onChange={e=>onChange(e.target.value)} onKeyDown={keyDown} disabled={!canUse} placeholder={placeholder} aria-label="Mensaje a la IA"/>
   <div className="ai-compose-actions">
    <VoiceInput projectId={projectId} workspaceId={workspaceId} purpose={purpose} value={value} onChange={onChange} maxLength={maxLength} disabled={!canUse} onBusy={onVoiceBusy} label="Dictar mensaje"/>
    <button className="ai-send-button" type="button" aria-label="Enviar mensaje" title="Enviar mensaje" disabled={!canUse||(!value.trim()&&!files.length)} onClick={send}><Send size={17}/></button>
   </div>
  </div>
  {dragging&&<div className="ai-drop-overlay">Suelta los archivos para adjuntarlos</div>}
  {error&&<p role="alert" className="error ai-compose-error">{error}</p>}
 </div>;
}

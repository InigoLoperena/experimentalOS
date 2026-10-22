'use client';
import {useEffect,useRef,useState} from 'react';
import {Mic,Square} from 'lucide-react';

type SpeechEvent={resultIndex:number;results:ArrayLike<ArrayLike<{transcript:string;confidence?:number}>>};
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onresult:((event:SpeechEvent)=>void)|null;onerror:(()=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
type SpeechWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
type TextField=HTMLInputElement|HTMLTextAreaElement;
const valid=(element:EventTarget|null):element is TextField=>{
 if(element instanceof HTMLTextAreaElement)return !element.disabled&&!element.readOnly;
 return element instanceof HTMLInputElement&&['text','search','url','email','tel'].includes(element.type)&&!element.disabled&&!element.readOnly;
};

export function EditorDictation(){
 const lastField=useRef<TextField|null>(null);
 const recognition=useRef<Recognition|null>(null);
 const [recording,setRecording]=useState(false);
 const [selected,setSelected]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  const remember=(event:Event)=>{
   if(valid(event.target)&&(event.target as Element).closest('dialog.edit-dialog')){
    lastField.current=event.target;setSelected(true);
   }
  };
  document.addEventListener('focusin',remember,true);
  document.addEventListener('pointerdown',remember,true);
  return()=>{document.removeEventListener('focusin',remember,true);document.removeEventListener('pointerdown',remember,true);recognition.current?.stop();recognition.current=null;};
 },[]);
 function toggle(){
  if(recognition.current){recognition.current.stop();return;}
  const field=lastField.current;
  if(!field||!field.isConnected||field.disabled||field.readOnly){setSelected(false);setError('Selecciona primero un campo de texto.');return;}
  const browser=window as SpeechWindow;
  const Constructor=browser.SpeechRecognition||browser.webkitSpeechRecognition;
  if(!Constructor){setError('El navegador no admite dictado por voz.');return;}
  setError('');
  const voice=new Constructor();
  voice.lang='es-ES';voice.continuous=true;voice.interimResults=false;
  voice.onresult=event=>{
   const target=lastField.current;
   if(!target||!target.isConnected||target.disabled||target.readOnly)return;
   const spoken=Array.from(event.results).slice(event.resultIndex).map(result=>result[0]?.transcript||'').join(' ').trim();
   if(!spoken)return;
   const begin=target.selectionStart??target.value.length;
   const end=target.selectionEnd??target.value.length;
   const prefix=target.value.slice(0,begin);
   const suffix=target.value.slice(end);
   const insertion=(prefix&&!/\s$/.test(prefix)?' ':'')+spoken+(suffix&&!/^\s/.test(suffix)?' ':'');
   const next=prefix+insertion+suffix;
   if(target.maxLength>=0&&next.length>target.maxLength){setError('El campo ha alcanzado su límite de caracteres.');return;}
   const proto=target instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
   Object.getOwnPropertyDescriptor(proto,'value')?.set?.call(target,next);
   target.dispatchEvent(new Event('input',{bubbles:true}));
   const cursor=begin+insertion.length;
   try{target.setSelectionRange(cursor,cursor);}catch{}
  };
  const end=()=>{if(recognition.current===voice){recognition.current=null;setRecording(false);}};
  voice.onerror=()=>{setError('No se pudo reconocer la voz. Comprueba los permisos del micrófono.');end();};
  voice.onend=end;
  recognition.current=voice;setRecording(true);
  try{voice.start();}catch{end();setError('No se pudo iniciar el micrófono.');}
 }
 return <div className="editor-dictation-control">
  <button type="button" className={'btn editor-dictation-trigger'+(recording?' recording':'')} onClick={toggle}
   disabled={!recording&&!selected} title={!selected?'Haz clic primero en el campo donde quieres dictar':recording?'Detener dictado':'Dictar en el último campo seleccionado'}
   aria-label={recording?'Detener dictado':'Dictar texto'}>
   {recording?<Square size={18}/>:<Mic size={20}/>} {recording?'Detener dictado':'Dictar texto'}
  </button>
  {error&&<span className="editor-dictation-error" role="alert">{error}</span>}
 </div>;
}

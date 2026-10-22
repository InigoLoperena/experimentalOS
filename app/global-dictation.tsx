'use client';
import {useEffect} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {Mic} from 'lucide-react';

type SpeechResult={resultIndex:number;results:ArrayLike<ArrayLike<{transcript:string}>>};
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onresult:((e:SpeechResult)=>void)|null;onerror:(()=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
type SpeechWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
function DictationButton({target}:{target:HTMLInputElement|HTMLTextAreaElement}){
 useEffect(()=>{},[]);
 return <button type="button" className="global-dictation-button" aria-label="Dictar texto" title="Dictar texto" onClick={event=>{
  const button=event.currentTarget;
  const W=window as SpeechWindow;const Constructor=W.SpeechRecognition||W.webkitSpeechRecognition;
  if(!Constructor){button.title='El dictado necesita un navegador compatible';return;}
  const active=(button as HTMLButtonElement & {recognition?:Recognition}).recognition;
  if(active){active.stop();return;}
  const recognition=new Constructor();recognition.lang='es-ES';recognition.continuous=true;recognition.interimResults=false;
  (button as HTMLButtonElement & {recognition?:Recognition}).recognition=recognition;
  button.classList.add('is-recording');button.setAttribute('aria-label','Detener dictado');button.title='Detener dictado';
  const reset=()=>{(button as HTMLButtonElement & {recognition?:Recognition}).recognition=undefined;button.classList.remove('is-recording');button.setAttribute('aria-label','Dictar texto');button.title='Dictar texto';};
  recognition.onend=reset;recognition.onerror=reset;
  recognition.onresult=e=>{if(!target.isConnected||target.disabled||target.readOnly)return;
   const transcript=Array.from(e.results).slice(e.resultIndex).map(result=>result[0]?.transcript||'').join(' ').trim();
   if(!transcript)return;
   const proto=target instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
   const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
   const next=(target.value.trim()?target.value.trimEnd()+' ':'')+transcript;
   if(target.maxLength>=0&&next.length>target.maxLength)return;
   setter?.call(target,next);target.dispatchEvent(new Event('input',{bubbles:true}));
  };
  try{recognition.start();}catch{reset();}
 }}><Mic size={16}/></button>;
}
/** Adds dictation to editable text fields, including dialogs mounted after initial load. */
export function GlobalDictation(){
 useEffect(()=>{
  const roots=new Map<HTMLElement,Root>();
  const eligible=(el:Element):el is HTMLInputElement|HTMLTextAreaElement=>{
   if(el instanceof HTMLTextAreaElement)return !el.readOnly&&!el.disabled&&!el.closest('.ai-prompt-composer, .voice-input');
   if(!(el instanceof HTMLInputElement))return false;
   return ['text','search','url','email','tel'].includes(el.type)&&!el.readOnly&&!el.disabled&&!el.closest('.ai-prompt-composer, .voice-input');
  };
  const scan=()=>{
   document.querySelectorAll('input,textarea').forEach(el=>{
    if(!eligible(el)||el.dataset.dictationAttached)return;
    const wrapper=document.createElement('span');wrapper.className='global-dictation-slot';
    el.insertAdjacentElement('afterend',wrapper);el.dataset.dictationAttached='true';
    const root=createRoot(wrapper);roots.set(wrapper,root);root.render(<DictationButton target={el}/>);
   });
   for(const [slot,root] of roots){if(!slot.isConnected){root.unmount();roots.delete(slot);}}
  };
  scan();const observer=new MutationObserver(()=>requestAnimationFrame(scan));
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>{observer.disconnect();for(const root of roots.values())root.unmount();roots.clear();};
 },[]);
 return null;
}

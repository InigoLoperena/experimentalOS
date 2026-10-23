"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Flag, FlaskConical, Lightbulb, Microscope, Pencil, Plus, Search, Target } from "lucide-react";
import type {Item} from "@/lib/model";
import {score} from "@/lib/model";
import {getMvpHierarchy} from "@/lib/mvp-hierarchy";
import {getProblemon,getProblemonCandidates,isProblemon} from "@/lib/problemon";

type Props={
 project:Item;items:Item[];readOnly:boolean;canCreate:boolean;canEdit:boolean;
 compact?:boolean;onCreate:()=>void;onDesignate:(record:Item)=>void;
 onOpen:(record:Item)=>void;onEdit:(record:Item)=>void;
};

/** A single read-only projection of a project opportunity shared across both trees. */
export function ProblemonSection({project,items,readOnly,canCreate,canEdit,compact=false,onCreate,onDesignate,onOpen,onEdit}:Props){
 const selected=getProblemon(items,project.id);
 const candidates=getProblemonCandidates(items,project.id);
 const [candidateId,setCandidateId]=useState("");
 useEffect(()=>setCandidateId(""),[project.id,selected?.id]);
 const candidate=candidates.find(item=>item.id===candidateId);
 const hierarchy=getMvpHierarchy(items,"mvp",project.id);
 const children=selected?hierarchy.children(selected.id):[];
 const renderChild=(item:Item,seen:Set<string>):ReactNode=>{
  if(seen.has(item.id))return null;
  const visited=new Set(seen);visited.add(item.id);
  const nested=hierarchy.children(item.id);
  const Icon=item.kind==="hypothesis"?Lightbulb:item.kind==="experiment"?FlaskConical:item.kind==="research"?Microscope:isProblemon(item)?Flag:Search;
  const color=item.kind==="hypothesis"?"var(--hypothesis-accent)":item.kind==="experiment"?"var(--experiment-accent)":item.kind==="research"?"#75c1ff":"var(--red-text)";
  return <div key={item.id} className={"problemon-descendant problemon-descendant-"+item.kind}>
   <button type="button" className="problemon-child-record" onClick={()=>onOpen(item)}>
    <Icon size={16} color={color} aria-hidden="true"/>
    <span style={{color}}>{item.title}{(item.kind==="experiment"||item.kind==="hypothesis"||["impact","confidence","ease"].some(key=>item.fields[key]!==undefined))&&<small className="hierarchy-ice">ICE {score(item.fields)}</small>}</span>
   </button>
   {nested.length>0&&<details className="goi-hierarchy-toggle problemon-children-toggle">
    <summary>
     <ChevronRight size={15} aria-hidden="true"/>
     <span className="goi-toggle-show">Mostrar hijos ({nested.length})</span>
     <span className="goi-toggle-hide">Ocultar hijos ({nested.length})</span>
    </summary>
    <div className="goi-hierarchy-children">{nested.map(child=>renderChild(child,visited))}</div>
   </details>}
  </div>;
 };
 return <section className={"problemon-panel"+(compact?" problemon-compact":"")} aria-label={"Problema principal de "+project.title}>
  {selected?<>
   <div className="problemon-primary">
    <div className="problemon-primary-row">
     <button type="button" className="problemon-primary-title" onClick={()=>onOpen(selected)}>
      <Flag size={21} color="var(--red-text)" aria-hidden="true"/><span>{selected.title}</span>
     </button>
     {!readOnly&&canEdit&&<button type="button" className="icon-button" title="Editar problema principal" aria-label="Editar problema principal" onClick={()=>onEdit(selected)}><Pencil size={17}/></button>}
    </div>
    {String(selected.fields.description||"").trim()&&<p>{String(selected.fields.description)}</p>}
   </div>
   {!compact&&children.length>0&&<section className="problemon-tree" aria-label="Jerarquía del problema principal">
    <details className="goi-hierarchy-toggle problemon-children-toggle">
     <summary><ChevronRight size={15} aria-hidden="true"/><span className="goi-toggle-show">Mostrar hijos ({children.length})</span><span className="goi-toggle-hide">Ocultar hijos ({children.length})</span></summary>
     <div className="goi-hierarchy-children">{children.map(item=>renderChild(item,new Set([selected.id])))}</div>
    </details>
   </section>}
  </>:<>

   {!readOnly&&canCreate&&<button type="button" className="btn primary problemon-create" onClick={onCreate}>
    <Plus size={16} aria-hidden="true"/>Crear problema principal
   </button>}
   {!compact&&!readOnly&&canEdit&&candidates.length>0&&<div className="problemon-choose">
    <label htmlFor={"problemon-existing-"+project.id}>Seleccionar un problema u oportunidad existente</label>
    <div><select id={"problemon-existing-"+project.id} value={candidateId} onChange={event=>setCandidateId(event.target.value)}>
      <option value="">Selecciona una ficha existente…</option>
      {candidates.map(item=><option value={item.id} key={item.id}>{item.title}</option>)}
     </select>
     <button type="button" className="btn" disabled={!candidate} onClick={()=>{if(candidate)onDesignate(candidate);}}>
      Designar como problema principal
     </button></div>

   </div>}
  </>}
 </section>;
}

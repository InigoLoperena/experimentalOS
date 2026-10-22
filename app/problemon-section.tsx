"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Flag, FlaskConical, Lightbulb, Microscope, Pencil, Plus, Search, Target } from "lucide-react";
import type {Item} from "@/lib/model";
import {getMvpHierarchy} from "@/lib/mvp-hierarchy";
import {getProblemon,getProblemonCandidates} from "@/lib/problemon";

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
 const hierarchy=getMvpHierarchy(items,"mvp_problems",project.id);
 const children=selected?hierarchy.children(selected.id):[];
 const renderChild=(item:Item,seen:Set<string>):ReactNode=>{
  if(seen.has(item.id))return null;
  const visited=new Set(seen);visited.add(item.id);
  const nested=hierarchy.children(item.id);
  const Icon=item.kind==="hypothesis"?Lightbulb:item.kind==="experiment"?FlaskConical:item.kind==="research"?Microscope:Search;
  return <div key={item.id} className={"problemon-descendant problemon-descendant-"+item.kind}>
   <button type="button" className="problemon-child-record" onClick={()=>onOpen(item)}>
    <Icon size={16} aria-hidden="true"/>
    <span>{item.title}</span>
   </button>
   {nested.length>0&&<details open className="goi-hierarchy-toggle problemon-children-toggle">
    <summary onClick={event=>{
     const parent=event.currentTarget.parentElement as HTMLDetailsElement|null;
     if(!parent)return;
     const opening=!parent.open;
     parent.querySelectorAll("details.goi-hierarchy-toggle").forEach(node=>{(node as HTMLDetailsElement).open=opening;});
    }}>
     <ChevronRight size={15} aria-hidden="true"/>
     <span className="goi-toggle-show">Mostrar hijos ({nested.length})</span>
     <span className="goi-toggle-hide">Ocultar hijos ({nested.length})</span>
    </summary>
    <div className="goi-hierarchy-children">{nested.map(child=>renderChild(child,visited))}</div>
   </details>}
  </div>;
 };
 return <section className={"problemon-panel"+(compact?" problemon-compact":"")} aria-label={"Problemon de "+project.title}>
  <header className="problemon-header">
   <div className="problemon-heading">
    <span className="problemon-icon"><Flag size={23} aria-hidden="true"/></span>
    <div><span className="eyebrow">Problema u oportunidad principal</span>
     <h2>Problemon <small>· {project.title}</small></h2>
     <p>Una única oportunidad principal por proyecto, compartida entre Growth Tree y MVPs Tree.</p>
    </div>
   </div>
   {selected&&<div className="problemon-header-actions">
    <button type="button" className="btn" onClick={()=>onOpen(selected)}>Abrir ficha</button>
    {!readOnly&&canEdit&&<button type="button" className="btn" onClick={()=>onEdit(selected)}>
     <Pencil size={15} aria-hidden="true"/>Editar / cambiar designación
    </button>}
   </div>}
  </header>
  {selected?<>
   <div className="problemon-primary">
    
    <button type="button" className="problemon-primary-title" onClick={()=>onOpen(selected)}>{selected.title}</button>
    {String(selected.fields.description||"").trim()&&<p>{String(selected.fields.description)}</p>}
    <div className="problemon-meta">
     <span>{children.filter(item=>item.kind==="hypothesis").length} hipótesis vinculadas</span>
     <span>{String(selected.fields.opportunity_type||"Problema u oportunidad")}</span>
    </div>
   </div>
   {!compact&&children.length>0&&<section className="problemon-tree" aria-label="Jerarquía del Problemon">
    <h3>Hipótesis, experimentos e investigaciones vinculadas</h3>
    <div className="goi-hierarchy-children">{children.map(item=>renderChild(item,new Set([selected.id])))}</div>
   </section>}
  </>:<>
   <p className="problemon-empty">Este proyecto todavía no tiene un Problemon. Puedes crear uno o designar una oportunidad existente sin duplicar registros.</p>
   {!readOnly&&canCreate&&<button type="button" className="btn primary problemon-create" onClick={onCreate}>
    <Plus size={16} aria-hidden="true"/>Crear Problemon
   </button>}
   {!compact&&!readOnly&&canEdit&&candidates.length>0&&<div className="problemon-choose">
    <label htmlFor={"problemon-existing-"+project.id}>Seleccionar un problema u oportunidad existente</label>
    <div><select id={"problemon-existing-"+project.id} value={candidateId} onChange={event=>setCandidateId(event.target.value)}>
      <option value="">Selecciona una ficha existente…</option>
      {candidates.map(item=><option value={item.id} key={item.id}>{item.title}</option>)}
     </select>
     <button type="button" className="btn" disabled={!candidate} onClick={()=>{if(candidate)onDesignate(candidate);}}>
      Designar como Problemon
     </button></div>
    <small>Su identificador, comentarios, archivos y relaciones seguirán siendo los mismos.</small>
   </div>}
  </>}
 </section>;
}

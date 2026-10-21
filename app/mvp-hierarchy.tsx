"use client";
import { ChevronRight, FlaskConical, Lightbulb, Microscope, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Item, Kind } from "@/lib/model";
import { getMvpHierarchy, type MvpHierarchyView } from "@/lib/mvp-hierarchy";
import { linkedHypothesis, linkedResearchIds } from "@/lib/mvp-relationships";
type Props={
 view:MvpHierarchyView;project:Item;items:Item[];readOnly:boolean;
 canCreate:(kind:Kind)=>boolean;canEdit:(kind:Kind)=>boolean;canDelete:(kind:Kind)=>boolean;
 onCreate:(kind:Kind,parent:string|null)=>void;onOpen:(item:Item)=>void;onEdit:(item:Item)=>void;onDelete:(item:Item)=>void;
};
const labels:Record<MvpHierarchyView,{title:string,description:string,action:string,kind:Kind}>={
 mvp:{title:"Árbol de validación",description:"Problemas u oportunidades → hipótesis → experimentos o investigación. Todos los niveles aparecen desplegados para mostrar sus relaciones.",action:"Añadir problema u oportunidad",kind:"opportunity"},
 mvp_problems:{title:"Problemas u Oportunidades",description:"Son la raíz de esta jerarquía. Cada uno puede tener varias hipótesis, además de investigaciones vinculadas.",action:"Añadir problema u oportunidad",kind:"opportunity"},
 mvp_hypotheses:{title:"Hipótesis",description:"Cada hipótesis es hija de un problema u oportunidad y puede comprobarse con investigaciones o experimentos.",action:"Añadir hipótesis",kind:"hypothesis"},
 mvp_experiments:{title:"Experimentos",description:"Los experimentos pueden validar hipótesis; sus vínculos con las ideas de GOI Tree permanecen independientes.",action:"Añadir experimento",kind:"experiment"},
 mvp_research:{title:"Investigación",description:"Entrevistas, encuestas y otras investigaciones vinculables a uno o varios problemas o hipótesis.",action:"Añadir investigación",kind:"research"},
};
const accents:{[K in Item["kind"]]?:string}={opportunity:"problem",hypothesis:"hypothesis",experiment:"experiment",research:"research"};
const title:{[K in Item["kind"]]?:string}={opportunity:"Problema u Oportunidad",hypothesis:"Hipótesis",experiment:"Experimento",research:"Investigación"};
function ItemIcon({kind}:{kind:Kind}){
 if(kind==="hypothesis")return <Lightbulb size={17} aria-hidden="true"/>;
 if(kind==="experiment")return <FlaskConical size={17} aria-hidden="true"/>;
 if(kind==="research")return <Microscope size={17} aria-hidden="true"/>;
 return <Search size={17} aria-hidden="true"/>;
}
export function MvpHierarchy({view,project,items,readOnly,canCreate,canEdit,canDelete,onCreate,onOpen,onEdit,onDelete}:Props){
 const hierarchy=getMvpHierarchy(items,view,project.id),meta=labels[view];
 const byId=new Map(items.map(item=>[item.id,item]));
 const add=(label:string,kind:Kind,parentId:string|null=null)=>
  !readOnly&&canCreate(kind)&&<button type="button" className="mvp-hierarchy-add" onClick={()=>onCreate(kind,parentId)}><Plus size={14} aria-hidden="true"/>{label}</button>;
 const childActions=(item:Item)=>{
  if(item.kind==="opportunity")return <>{add("Añadir hipótesis","hypothesis",item.id)}{add("Vincular nueva investigación","research",item.id)}</>;
  if(item.kind==="hypothesis")return <>{add("Añadir experimento","experiment",item.id)}{add("Investigar esta hipótesis","research",item.id)}</>;
  return null;
 };
 const node=(item:Item,visited:Set<string>):React.ReactNode=>{
  if(visited.has(item.id))return null;
  const next=new Set(visited);next.add(item.id);
  const descendants=hierarchy.children(item.id);
  const relationship=item.kind==="experiment"
   ? byId.get(linkedHypothesis(item))?.title||"Sin hipótesis vinculada"
   : item.kind==="research"
     ? linkedResearchIds(item).map(id=>byId.get(id)?.title).filter(Boolean).join(" · ")||"Sin vínculos"
     : item.kind==="hypothesis"?byId.get(item.parent_id||"")?.title||"Sin problema vinculado"
     : null;
  const description=String(item.fields.description||item.fields.belief||item.fields.context||"").trim();
  return <div className="mvp-hierarchy-node" key={item.id}>
   <article className={"mvp-hierarchy-record mvp-hierarchy-"+accents[item.kind]}>
    <span className="mvp-hierarchy-record-icon"><ItemIcon kind={item.kind}/></span>
    <div className="mvp-hierarchy-record-text">
     <span className="mvp-hierarchy-kind">{item.kind==="opportunity"&&item.fields.opportunity_type
      ?String(item.fields.opportunity_type):title[item.kind]}</span>
     <button type="button" className="mvp-hierarchy-title" onClick={()=>onOpen(item)}>{item.title}</button>
     {description&&<p>{description}</p>}
     {relationship&&<span className="mvp-hierarchy-relation">{item.kind==="research"?"Vinculada a":item.kind==="experiment"?"Hipótesis": "Hijo de"}: {relationship}</span>}
    </div>
    {!readOnly&&<div className="mvp-hierarchy-actions">
     {canEdit(item.kind)&&<button title="Editar" aria-label={"Editar "+item.title} onClick={()=>onEdit(item)}><Pencil size={16}/></button>}
     {canDelete(item.kind)&&<button title="Eliminar" aria-label={"Eliminar "+item.title} onClick={()=>onDelete(item)}><Trash2 size={16}/></button>}
    </div>}
   </article>
   {descendants.length>0&&<details className="goi-hierarchy-toggle mvp-hierarchy-toggle" open={hierarchy.expanded.has(item.id)} key={view+":"+item.id}>
    <summary onClick={event=>{
      const branch=event.currentTarget.parentElement as HTMLDetailsElement|null;
      if(!branch)return;
      const opening=!branch.open;
      // Match GOI Tree's "Mostrar hijos": one click unfolds the whole branch.
      branch.querySelectorAll("details.goi-hierarchy-toggle").forEach(el=>{(el as HTMLDetailsElement).open=opening;});
    }}>
     <ChevronRight size={16} aria-hidden="true"/>
     <span className="goi-toggle-show">Mostrar hijos ({descendants.length})</span>
     <span className="goi-toggle-hide">Ocultar hijos ({descendants.length})</span>
    </summary>
    <div className="goi-hierarchy-children">{descendants.map(child=>node(child,next))}</div>
   </details>}
   {!readOnly&&childActions(item)&&<div className="mvp-hierarchy-child-actions">{childActions(item)}</div>}
  </div>;
 };
 const group=(item:Item)=><section className="goi-hierarchy-group mvp-hierarchy-group" key={item.id}>{node(item,new Set())}</section>;
 return <div className="mvp-hierarchy-screen">
  <section className="mvp-hierarchy-heading panel">
   <div><span className="eyebrow">MVPs Tree · {project.title}</span><h2>{meta.title}</h2><p>{meta.description}</p></div>
   {add(meta.action,meta.kind)}
  </section>
  <div className="mvp-hierarchy-list">
   {hierarchy.roots.map(group)}
   {hierarchy.unlinked.length>0&&<section className="goi-orphans-section mvp-hierarchy-unlinked">
     <div className="goi-orphans-heading"><h2>Sin vincular <span>({hierarchy.unlinked.length})</span></h2>
     <p>Estos registros se conservan aunque falte su padre. Puedes asignarlo abriendo la ficha.</p></div>
     {hierarchy.unlinked.map(group)}
   </section>}
   {!hierarchy.target.length&&<div className="mvp-hierarchy-empty panel">
     <p>Aún no hay {meta.title.toLocaleLowerCase("es")} en este proyecto.</p>
     {add(meta.action,meta.kind)}
   </div>}
  </div>
 </div>;
}

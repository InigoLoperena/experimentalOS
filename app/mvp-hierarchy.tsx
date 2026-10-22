"use client";
import { useState } from "react";
import { score } from "@/lib/model";
import { linkedHypothesis } from "@/lib/mvp-relationships";
import { Flag, ChevronRight, FlaskConical, Lightbulb, Microscope, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Item, Kind } from "@/lib/model";
import { getMvpHierarchy, type MvpHierarchyView } from "@/lib/mvp-hierarchy";
import { isProblemon } from "@/lib/problemon";
type Props={
 view:MvpHierarchyView;project:Item;items:Item[];readOnly:boolean;
 canCreate:(kind:Kind)=>boolean;canEdit:(kind:Kind)=>boolean;canDelete:(kind:Kind)=>boolean;
 onCreate:(kind:Kind,parent:string|null)=>void;onOpen:(item:Item)=>void;onEdit:(item:Item)=>void;onDelete:(item:Item)=>void;
};
const labels:Record<MvpHierarchyView,{title:string,description:string,action:string,kind:Kind}>={
 mvp:{title:"Árbol de validación",description:"Problemas u oportunidades → hipótesis → experimentos o investigación. Todos los niveles aparecen desplegados para mostrar sus relaciones.",action:"Añadir problema u oportunidad",kind:"opportunity"},
 mvp_problems:{title:"Problemas u Oportunidades",description:"Son la raíz de esta jerarquía. Cada uno puede tener varias hipótesis, además de investigaciones vinculadas.",action:"Añadir problema u oportunidad",kind:"opportunity"},
 mvp_main_hypothesis:{title:"Hipótesis principal",description:"Una hipótesis principal por proyecto, bajo el Problemón. Es el padre predeterminado de los experimentos nuevos.",action:"Crear hipótesis principal",kind:"hypothesis"},
 mvp_hypotheses:{title:"Hipótesis",description:"Cada hipótesis es hija de un problema u oportunidad y puede comprobarse con investigaciones o experimentos.",action:"Añadir hipótesis",kind:"hypothesis"},
 mvp_experiments:{title:"Experimentos",description:"Los experimentos pueden validar hipótesis; la misma hipótesis se utiliza en Growth Tree y MVPs Tree.",action:"Añadir experimento",kind:"experiment"},
 mvp_research:{title:"Investigación",description:"Entrevistas, encuestas y otras investigaciones vinculables a uno o varios problemas o hipótesis.",action:"Añadir investigación",kind:"research"},
};
const accents:{[K in Item["kind"]]?:string}={opportunity:"problem",hypothesis:"hypothesis",experiment:"experiment",research:"research"};
const title:{[K in Item["kind"]]?:string}={opportunity:"Problema u Oportunidad",hypothesis:"Hipótesis",experiment:"Experimento",research:"Investigación"};
/** Semantic identity, shared by tree cards and expanded ancestor cards. */
const semanticColor=(kind:Kind)=>kind==="opportunity"?"var(--red-text)":kind==="hypothesis"?"var(--hypothesis-accent)":kind==="experiment"?"var(--experiment-accent)":kind==="research"?"#75c1ff":"var(--ink)";
function ItemIcon({kind,problemon=false}:{kind:Kind;problemon?:boolean}){
 const color=semanticColor(kind);
 if(problemon)return <Flag size={17} color={color} aria-hidden="true"/>;
 if(kind==="hypothesis")return <Lightbulb size={17} color={color} aria-hidden="true"/>;
 if(kind==="experiment")return <FlaskConical size={17} color={color} aria-hidden="true"/>;
 if(kind==="research")return <Microscope size={17} color={color} aria-hidden="true"/>;
 return <Search size={17} color={color} aria-hidden="true"/>;
}
export function MvpHierarchy({view,project,items,readOnly,canCreate,canEdit,canDelete,onCreate,onOpen,onEdit,onDelete}:Props){
 const hierarchy=getMvpHierarchy(items,view,project.id),meta=labels[view];
 const [openParents,setOpenParents]=useState<Set<string>>(()=>new Set());
 const allProjectItems=items.filter(item=>item.project_id===project.id);
 const byId=new Map(allProjectItems.map(item=>[item.id,item]));
 const mainHypothesis=allProjectItems.find(item=>item.kind==="hypothesis"&&item.fields.is_main_hypothesis===true);
 const experiments=allProjectItems.filter(item=>item.kind==="experiment").sort((a,b)=>score(b.fields)-score(a.fields)||a.title.localeCompare(b.title,"es"));
 const parentsOf=(experiment:Item):Item[]=>{
  const path:Item[]=[];const visited=new Set<string>([experiment.id]);
  let id=linkedHypothesis(experiment);
  while(id&&!visited.has(id)){
   visited.add(id);
   const parent=byId.get(id);
   if(!parent||!["hypothesis","opportunity"].includes(parent.kind))break;
   path.unshift(parent);
   id=parent.parent_id||"";
  }
  return path;
 };
 const parentRow=(item:Item)=><div key={item.id}
  className={"mvp-upward-parent semantic-"+(isProblemon(item)?"problemon":item.kind)}>
  <span className="mvp-hierarchy-record-icon" style={{color:semanticColor(item.kind)}}>
   <ItemIcon kind={item.kind} problemon={isProblemon(item)}/>
  </span>
  <span><button type="button" style={{color:semanticColor(item.kind)}} onClick={()=>onOpen(item)}>{item.title}</button></span>
 </div>;
 const toggleParents=(id:string)=>setOpenParents(previous=>{
  const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next;
 });
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
  const description=String(item.fields.description||item.fields.belief||item.fields.context||"").trim();
  return <div className="mvp-hierarchy-node" key={item.id}>
   <article className={"mvp-hierarchy-record mvp-hierarchy-"+accents[item.kind]+(isProblemon(item)?" mvp-hierarchy-problemon":"")}>
    <span className="mvp-hierarchy-record-icon"><ItemIcon kind={item.kind} problemon={isProblemon(item)}/></span>
    <div className="mvp-hierarchy-record-text">
     
     <button type="button" className="mvp-hierarchy-title" style={{color:semanticColor(item.kind)}} onClick={()=>onOpen(item)}>{item.title}</button>
     {description&&<p>{description}</p>}

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
      // Match Growth Tree's "Mostrar hijos": one click unfolds the whole branch.
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
 if(view==="mvp_main_hypothesis")return <div className="mvp-hierarchy-screen">
   <section className="mvp-hierarchy-heading panel"><div><span className="eyebrow">MVPs Tree · {project.title}</span>
    <h2>Hipótesis principal</h2><p>La hipótesis principal se vincula por defecto al Problemón y es el padre predeterminado de nuevos experimentos.</p></div>
    {!mainHypothesis&&add("Crear hipótesis principal","hypothesis")}
   </section>
   {mainHypothesis?<div className="mvp-hierarchy-list">{node(mainHypothesis,new Set())}</div>:
    <p className="mvp-hierarchy-empty panel">No hay hipótesis principal. Crea una o designa una editando una hipótesis existente.</p>}
  </div>;
 if(view==="mvp_experiments")return <div className="mvp-hierarchy-screen">
  <section className="mvp-hierarchy-heading panel">
   <div><span className="eyebrow">MVPs Tree · {project.title}</span><h2>Experimentos ({experiments.length})</h2>
    <p>Ordenados de mayor a menor puntuación ICE. Despliega los padres de cada experimento para ver su jerarquía hacia abajo.</p></div>
   {add("Añadir experimento","experiment")}
  </section>
  <div className="mvp-experiment-ranked-list">
   {experiments.map((experiment,index)=>{
    const ancestors=parentsOf(experiment),expanded=openParents.has(experiment.id),ice=score(experiment.fields);
    return <section key={experiment.id} className="mvp-experiment-ranked-entry">
     
     <article className="mvp-hierarchy-record mvp-hierarchy-experiment mvp-experiment-ranked-card">
      <span className="mvp-hierarchy-record-icon" style={{color:semanticColor("experiment")}}><FlaskConical size={17} color="var(--experiment-accent)" aria-hidden="true"/></span>
      <div className="mvp-hierarchy-record-text">
       
       <button type="button" className="mvp-hierarchy-title" style={{color:semanticColor("experiment")}} onClick={()=>onOpen(experiment)}>{experiment.title}</button>
       <span className="mvp-experiment-ice">ICE: <strong>{ice}</strong> <small>(Impacto {String(experiment.fields.impact??"—")} · Confianza {String(experiment.fields.confidence??"—")} · Facilidad {String(experiment.fields.ease??"—")})</small></span>
      </div>
      <div className="mvp-experiment-ranked-actions">
       <button type="button" className="btn" onClick={()=>toggleParents(experiment.id)} aria-expanded={expanded} disabled={!ancestors.length}>
        <ChevronRight size={16} className={expanded?"mvp-upward-open":""} aria-hidden="true"/>
        {expanded?"Ocultar padres":"Desplegar padres"} ({ancestors.length})
       </button>
       {!readOnly&&canEdit("experiment")&&<button type="button" title="Editar" aria-label={"Editar "+experiment.title} onClick={()=>onEdit(experiment)}><Pencil size={16}/></button>}
       {!readOnly&&canDelete("experiment")&&<button type="button" title="Eliminar" aria-label={"Eliminar "+experiment.title} onClick={()=>onDelete(experiment)}><Trash2 size={16}/></button>}
      </div>
     </article>
     {expanded&&ancestors.length>0&&<div className="mvp-upward-chain" aria-label={"Padres de "+experiment.title}>{ancestors.slice().reverse().map(parentRow)}</div>}
    </section>;
   })}
   {!experiments.length&&<div className="mvp-hierarchy-empty panel">Todavía no hay experimentos en este proyecto. {add("Añadir experimento","experiment")}</div>}
  </div>
 </div>;
 const group=(item:Item)=><section className="goi-hierarchy-group mvp-hierarchy-group" key={item.id}>{node(item,new Set())}</section>;
 return <div className="mvp-hierarchy-screen">
  <section className="mvp-hierarchy-heading panel">
   <div><span className="eyebrow">MVPs Tree · {project.title}</span><h2>{meta.title}</h2><p>{meta.description}</p></div>
   {add(meta.action,meta.kind)}
  </section>
  <div className="mvp-hierarchy-list">
   {hierarchy.roots.filter(item=>view!=="mvp_hypotheses" || item.fields.is_main_hypothesis!==true).map(group)}
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

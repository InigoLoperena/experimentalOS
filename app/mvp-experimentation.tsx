"use client";
import { useEffect, useState } from "react";
import { BarChart3, ChevronRight, ExternalLink, FlaskConical, Gift, Layers, Leaf, Lightbulb, Link2, Microscope, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import type { Item, Kind } from "@/lib/model";
import { buildMvpBoard, linkedHypothesis, linkedResearchIds } from "@/lib/mvp-relationships";
export { linkedHypothesis } from "@/lib/mvp-relationships";

export const mvpProjectFields = [
 { key:"site_url",label:"Web" }, { key:"targets",label:"Targets" },
 { key:"value_propositions",label:"Propuestas de valor" },
 { key:"monetization_channels",label:"Vías de monetización" },
 { key:"north_star",label:"North Star Metric" },
] as const;
export function mvpTargets(record:Item):string[]{return linkedResearchIds(record);}
function safeProjectUrl(value:unknown):string|null{
 try{const url=new URL(String(value||""));return ["http:","https:"].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}
 catch{return null;}
}
type Props={
 project:Item; items:Item[];readOnly:boolean;
 canCreate:(kind:Kind)=>boolean;canEdit:(kind:Kind)=>boolean;canDelete:(kind:Kind)=>boolean;
 onCreate:(kind:Kind,parent:string|null)=>void;onOpen:(item:Item)=>void;onEdit:(item:Item)=>void;
 onDelete:(item:Item)=>void;onEditProject:()=>void;
};
type Role="research"|"problem"|"hypothesis"|"experiment";
const content=(value:unknown)=>String(value??"").trim();
export function MvpExperimentation({project,items,readOnly,canCreate,canEdit,canDelete,onCreate,onOpen,onEdit,onDelete,onEditProject}:Props){
 const [expanded,setExpanded]=useState(true);
 const [revision,setRevision]=useState(0);
 const [problemId,setProblemId]=useState<string|null>(null);
 const [hypothesisId,setHypothesisId]=useState<string|null>(null);
 useEffect(()=>{setProblemId(null);setHypothesisId(null);},[project.id]);
 // This projects the same GOI/experiment records; it never duplicates or changes them.
 const data=buildMvpBoard(items,project.id,problemId,hypothesisId);
 const names=new Map(data.items.map(item=>[item.id,item.title]));
 const focusProblem=data.selectedProblem,focusHypothesis=data.selectedHypothesis;
 const filtered=!!focusProblem||!!focusHypothesis;
 const createButton=(label:string,kind:Kind,parent:string|null=null)=>
  !readOnly&&canCreate(kind)&&<button className="mvp-add" type="button" onClick={()=>onCreate(kind,parent)}><Plus size={14}/>{label}</button>;
 const row=(label:string,value:unknown)=>content(value)&&<div className="mvp-fact" key={label}><dt>{label}</dt><dd>{content(value)}</dd></div>;
 const rows=(title:string,values:Array<[string,unknown]>)=>values.some(([,v])=>content(v))&&
  <section className="mvp-card-section"><h4>{title}</h4><dl>{values.map(([label,value])=>row(label,value))}</dl></section>;
 const toggleProblem=(item:Item)=>{setProblemId(old=>old===item.id?null:item.id);setHypothesisId(null);};
 const toggleHypothesis=(item:Item)=>setHypothesisId(old=>old===item.id?null:item.id);
 const card=(item:Item,role:Role)=>{
  const selected=role==="problem"?focusProblem?.id===item.id:role==="hypothesis"&&focusHypothesis?.id===item.id;
  const links=role==="research"?linkedResearchIds(item).filter(id=>names.has(id)):[];
  const problemCount=data.hypotheses.filter(h=>h.parent_id===item.id).length;
  const experimentCount=data.experiments.filter(e=>linkedHypothesis(e)===item.id).length;
  return <details key={item.id+":"+revision} open={expanded} className={"mvp-card mvp-card-"+role+(selected?" mvp-card-selected":"")}>
   <summary className="mvp-card-heading">
    <span className="mvp-card-icon" aria-hidden="true">{role==="research"?<Microscope size={17}/>:role==="problem"?<Search size={17}/>:role==="hypothesis"?<Lightbulb size={17}/>:<FlaskConical size={17}/>}</span>
    <span className="mvp-card-title">{item.title}</span><ChevronRight className="mvp-card-chevron" size={15}/>
   </summary>
   <div className="mvp-card-body">
    {role==="research"&&<>
     {rows("Diseño",[["Descripción",item.fields.description],["Target",item.fields.audience],["Método",item.fields.method]])}
     {rows("Resultados",[["Hallazgos",item.fields.findings],["Aprendizaje",item.fields.learning]])}
     <div className="mvp-relation-label">Vinculada a</div>
     <div className="mvp-relation-list">{links.length?links.map(id=><button type="button" className="mvp-link-chip" key={id} onClick={()=>{
      const related=data.items.find(v=>v.id===id);
      if(related?.kind==="opportunity")toggleProblem(related);
      if(related?.kind==="hypothesis"){setProblemId(null);toggleHypothesis(related);}
     }}>{names.get(id)}</button>):<span className="mvp-muted">Sin vincular todavía</span>}</div>
    </>}
    {role==="problem"&&<>
     {rows("Descripción",[["Descripción",item.fields.description]])}
     {rows("Evidencias",[["Evidencias disponibles",item.fields.evidence],["Fuentes y enlaces",item.fields.source]])}
     {!item.parent_id&&<p className="mvp-unlinked">Sin objetivo o Input Metric en GOI Tree</p>}
     <button type="button" className={"mvp-focus-button"+(selected?" active":"")} aria-pressed={selected} onClick={()=>toggleProblem(item)}>
      {selected?"Mostrar todas las hipótesis":"Ver hipótesis ("+problemCount+")"} <ChevronRight size={14}/>
     </button>
    </>}
    {role==="hypothesis"&&<>
     <div className="mvp-relation-label">Problema u oportunidad</div>
     <span className="mvp-link-chip">{names.get(item.parent_id||"")||"Sin problema asociado"}</span>
     {rows("Hipótesis",[["¿Qué creemos que es cierto?",item.fields.belief],["¿Por qué lo creemos?",item.fields.reason]])}
     {rows("Validación",[["¿Qué necesitamos comprobar?",item.fields.validation_need]])}
     <button type="button" className={"mvp-focus-button"+(selected?" active":"")} aria-pressed={selected} onClick={()=>toggleHypothesis(item)}>
      {selected?"Mostrar todos los experimentos":"Ver experimentos ("+experimentCount+")"} <ChevronRight size={14}/>
     </button>
    </>}
    {role==="experiment"&&<>
     <div className="mvp-relation-label">Hipótesis</div><span className="mvp-link-chip">{names.get(linkedHypothesis(item))||"Sin hipótesis"}</span>
     {rows("Diseño",[["Descripción",item.fields.description||item.fields.context],["Target",item.fields.audience]])}
     {rows("Medición",[["North Star Metric principal",item.fields.metric],["Criterio de éxito",item.fields.success_criteria],["Fecha de inicio",item.fields.start],["Fecha de finalización",item.fields.end]])}
     {rows("Resultados y conclusiones",[["Resultados obtenidos",item.fields.result],["Aprendizaje",item.fields.learning],["Decisión",item.fields.decision]])}
     {item.parent_id&&names.has(item.parent_id)&&<p className="mvp-unlinked">Idea en GOI Tree: {names.get(item.parent_id)}</p>}
    </>}
    <div className="mvp-card-footer">
     <button className="mvp-open" type="button" onClick={()=>onOpen(item)}>Abrir ficha completa <ExternalLink size={13}/></button>
     {!readOnly&&<div className="mvp-card-actions">
      {canEdit(item.kind)&&<button type="button" title="Editar ficha" aria-label={"Editar "+item.title} onClick={()=>onEdit(item)}><Pencil size={14}/></button>}
      {canDelete(item.kind)&&<button type="button" title="Eliminar ficha" aria-label={"Eliminar "+item.title} onClick={()=>onDelete(item)}><Trash2 size={14}/></button>}
     </div>}
    </div>
   </div>
  </details>;
 };
 const lines=(value:unknown)=>content(value).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const projectFields=[
  {key:"site_url",label:"Web",icon:<Link2 size={16}/>},
  {key:"targets",label:"Targets",icon:<Users size={16}/>},
  {key:"value_propositions",label:"Propuestas de valor",icon:<Gift size={16}/>},
  {key:"monetization_channels",label:"Vías de monetización",icon:<Layers size={16}/>},
  {key:"north_star",label:"North Star Metric",icon:<BarChart3 size={16}/>},
 ] as const;
 return <div className="mvp-workspace">
  <section className="mvp-project-summary" aria-label="Resumen del proyecto">
   <div className="mvp-project-top">
    <div className="mvp-project-identity">
     <div className="mvp-project-avatar" aria-hidden="true"><Leaf size={27}/></div>
     <div><span className="eyebrow">Experimentación de MVPs</span>
      <h2>Proyecto · <span>{project.title}</span></h2>
      <p>{content(project.fields.description)||"Investiga problemas y valida hipótesis del proyecto."}</p>
     </div>
    </div>
    {!readOnly&&canEdit("project")&&<button className="btn" type="button" onClick={onEditProject}><Pencil size={14}/> Editar proyecto</button>}
   </div>
   <div className="mvp-project-fields">{projectFields.map(field=><div className="mvp-project-field" key={field.key}>
    <div className="mvp-project-field-label">{field.icon}<strong>{field.label}</strong></div>
    {field.key==="site_url"&&safeProjectUrl(project.fields.site_url)
      ?<a href={safeProjectUrl(project.fields.site_url)!} target="_blank" rel="noopener noreferrer">{content(project.fields.site_url)} <ExternalLink size={13}/></a>
      :lines(project.fields[field.key]).length?<ul>{lines(project.fields[field.key]).map((line,index)=><li key={index}>{line}</li>)}</ul>:<span>Sin definir</span>}
   </div>)}</div>
  </section>
  <div className="mvp-flow-line" aria-hidden="true"><span/><span/><span/><span/></div>
  <div className="mvp-toolbar">
   <div><strong>De la investigación a la validación</strong><p>Selecciona un problema o hipótesis para ver sus relaciones sin modificar el GOI Tree.</p></div>
   <div className="mvp-toolbar-actions">
    {filtered&&<button className="mvp-clear" type="button" onClick={()=>{setProblemId(null);setHypothesisId(null);}}><X size={14}/> Mostrar todo</button>}
    <button className="mvp-clear" type="button" aria-pressed={expanded} onClick={()=>{setExpanded(v=>!v);setRevision(v=>v+1);}}>{expanded?"Contraer fichas":"Expandir fichas"}</button>
   </div>
  </div>
  <div className="mvp-board" aria-label="Flujo de Experimentación de MVPs">
   <section className="mvp-lane mvp-lane-research" aria-label="Investigación">
    <header className="mvp-lane-header"><span className="mvp-lane-icon"><Microscope size={20}/></span><div><h3>Investigación <small>({data.research.length})</small></h3><p>Descubrir y comprender problemas</p></div></header>
    {createButton("Añadir investigación","research")}
    <div className="mvp-lane-list">{data.research.map(item=>card(item,"research"))}</div>
    {!data.research.length&&<p className="mvp-empty">Entrevistas, encuestas o análisis de mercado. Vincula los hallazgos a problemas o hipótesis.</p>}
   </section>
   <section className="mvp-lane mvp-lane-problems" aria-label="Problemas u Oportunidades">
    <header className="mvp-lane-header"><span className="mvp-lane-icon"><Search size={20}/></span><div><h3>Problemas u Oportunidades <small>({data.problems.length})</small></h3><p>Retos y necesidades identificadas</p></div></header>
    {createButton("Añadir problema u oportunidad","opportunity")}
    <div className="mvp-lane-list">{data.problems.map(item=>card(item,"problem"))}</div>
    {!data.problems.length&&<p className="mvp-empty">Añade el primer problema u oportunidad del proyecto.</p>}
   </section>
   <section className="mvp-lane mvp-lane-hypotheses" aria-label="Hipótesis">
    <header className="mvp-lane-header"><span className="mvp-lane-icon"><Lightbulb size={20}/></span><div><h3>Hipótesis <small>({data.visibleHypotheses.length})</small></h3><p>{focusProblem?"Relacionadas con "+focusProblem.title:"Lo que necesitamos comprobar"}</p></div></header>
    {createButton("Añadir hipótesis","hypothesis",focusProblem?.id||null)}
    <div className="mvp-lane-list">
     {data.visibleHypotheses.filter(item=>data.problemIds.has(item.parent_id||"")).map(item=>card(item,"hypothesis"))}
     {!focusProblem&&data.orphanHypotheses.length>0&&<div className="mvp-orphan-group"><h4>Hipótesis sin problema ({data.orphanHypotheses.length})</h4>{data.orphanHypotheses.map(item=>card(item,"hypothesis"))}</div>}
    </div>
    {!data.visibleHypotheses.length&&<p className="mvp-empty">{focusProblem?"No hay hipótesis vinculadas a este problema.":"Formula hipótesis a partir de los problemas observados."}</p>}
   </section>
   <section className="mvp-lane mvp-lane-experiments" aria-label="Experimentos">
    <header className="mvp-lane-header"><span className="mvp-lane-icon"><FlaskConical size={20}/></span><div><h3>Experimentos <small>({data.visibleExperiments.length})</small></h3><p>{focusHypothesis?"Validando "+focusHypothesis.title:"Validación con pruebas reales"}</p></div></header>
    {createButton("Añadir experimento","experiment",focusHypothesis?.id||null)}
    <div className="mvp-lane-list">
     {data.visibleExperiments.filter(item=>data.hypothesisIds.has(linkedHypothesis(item))).map(item=>card(item,"experiment"))}
     {!filtered&&data.orphanExperiments.length>0&&<div className="mvp-orphan-group"><h4>Experimentos sin hipótesis ({data.orphanExperiments.length})</h4>{data.orphanExperiments.map(item=>card(item,"experiment"))}</div>}
    </div>
    {!data.visibleExperiments.length&&<p className="mvp-empty">{filtered?"No hay experimentos para esta selección.":"Diseña un experimento para comprobar una hipótesis."}</p>}
   </section>
  </div>
  <div className="mvp-flow-notes">
   <p><Microscope size={16}/><strong>Investigación = entender.</strong> Los hallazgos alimentan problemas e hipótesis.</p>
   <p><FlaskConical size={16}/><strong>Experimentos = validar.</strong> Los resultados ayudan a tomar decisiones.</p>
  </div>
 </div>;
}

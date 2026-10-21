"use client";
import { BarChart3, ExternalLink, FlaskConical, Gift, Layers, Leaf, Lightbulb, Link2, Microscope, Pencil, Users } from "lucide-react";
import type { Item, Kind } from "@/lib/model";
import { linkedResearchIds } from "@/lib/mvp-relationships";
import { MvpHierarchy } from "./mvp-hierarchy";

export const mvpProjectFields = [
  {key:"site_url",label:"Web"},
  {key:"targets",label:"Targets"},
  {key:"value_propositions",label:"Propuestas de valor"},
  {key:"monetization_channels",label:"Vías de monetización"},
  {key:"north_star",label:"North Star Metric"},
] as const;

// Research has many-to-many associations: keep this helper for existing consumers.
export function mvpTargets(record:Item):string[]{return linkedResearchIds(record);}

function safeProjectUrl(value:unknown):string|null{
 try {
  const url=new URL(String(value||""));
  return ["http:","https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
 }catch{return null;}
}

type Props = {
 project:Item;items:Item[];readOnly:boolean;
 canCreate:(kind:Kind)=>boolean;canEdit:(kind:Kind)=>boolean;canDelete:(kind:Kind)=>boolean;
 onCreate:(kind:Kind,parent:string|null)=>void;
 onOpen:(item:Item)=>void;onEdit:(item:Item)=>void;onDelete:(item:Item)=>void;
 onEditProject:()=>void;
};
const fieldText=(value:unknown)=>String(value??"").trim();
const lines=(value:unknown)=>fieldText(value).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);

export function MvpExperimentation({
 project,items,readOnly,canCreate,canEdit,canDelete,onCreate,onOpen,onEdit,onDelete,onEditProject,
}:Props){
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
     <div><span className="eyebrow">MVPs Tree</span>
      <h2>Proyecto · <span>{project.title}</span></h2>
      <p>{fieldText(project.fields.description)||"Investiga problemas y valida hipótesis del proyecto."}</p>
     </div>
    </div>
    {!readOnly && canEdit("project") &&
     <button className="btn" type="button" onClick={onEditProject}><Pencil size={14}/> Editar proyecto</button>}
   </div>
   <div className="mvp-project-fields">
    {projectFields.map(field=><div className="mvp-project-field" key={field.key}>
     <div className="mvp-project-field-label">{field.icon}<strong>{field.label}</strong></div>
     {field.key==="site_url" && safeProjectUrl(project.fields.site_url)
      ? <a href={safeProjectUrl(project.fields.site_url)!} target="_blank" rel="noopener noreferrer">
         {fieldText(project.fields.site_url)} <ExternalLink size={13}/>
        </a>
      : lines(project.fields[field.key]).length
        ? <ul>{lines(project.fields[field.key]).map((line,index)=><li key={index}>{line}</li>)}</ul>
        : <span>Sin definir</span>}
    </div>)}
   </div>
  </section>
  <div className="mvp-tree-path" aria-label="Jerarquía de validación">
   <span><Microscope size={16}/> Problemas u Oportunidades</span>
   <span aria-hidden="true">→</span>
   <span><Lightbulb size={16} aria-hidden="true"/> Hipótesis</span>
   <span aria-hidden="true">→</span>
   <span><FlaskConical size={16} aria-hidden="true"/> Experimentos / Investigación</span>
  </div>
  <MvpHierarchy
   key={project.id}
   view="mvp"
   project={project} items={items} readOnly={readOnly}
   canCreate={canCreate} canEdit={canEdit} canDelete={canDelete}
   onCreate={onCreate} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete}
  />
 </div>;
}

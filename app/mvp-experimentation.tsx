"use client";
import { Pencil } from "lucide-react";
import type { Item, Kind } from "@/lib/model";
import type { ReactNode } from "react";
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

type Props = {
 project:Item;items:Item[];readOnly:boolean;
 canCreate:(kind:Kind)=>boolean;canEdit:(kind:Kind)=>boolean;canDelete:(kind:Kind)=>boolean;
 onCreate:(kind:Kind,parent:string|null)=>void;
 onOpen:(item:Item)=>void;onEdit:(item:Item)=>void;onDelete:(item:Item)=>void;
 onEditProject:()=>void;
 problemonSection?:ReactNode;
};
export function MvpExperimentation({
 project,items,readOnly,canCreate,canEdit,canDelete,onCreate,onOpen,onEdit,onDelete,onEditProject,problemonSection,
}:Props){
 return <div className="mvp-workspace">
  {!readOnly&&canEdit("project")&&<div className="mvp-section-actions">
   <button className="btn" type="button" onClick={onEditProject}><Pencil size={14}/> Editar proyecto</button>
  </div>}
  {problemonSection}
  <MvpHierarchy
   key={project.id}
   view="mvp"
   project={project} items={items} readOnly={readOnly}
   canCreate={canCreate} canEdit={canEdit} canDelete={canDelete}
   onCreate={onCreate} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete}
  />
 </div>;
}

import type { Item } from "./model";
import { linkedHypothesis, linkedResearchIds } from "./mvp-relationships";

export type MvpHierarchyView = "mvp_problems" | "mvp_hypotheses" | "mvp_experiments" | "mvp_research";
const displayKinds = new Set<Item["kind"]>(["opportunity", "hypothesis", "experiment", "research"]);
const byDateAndTitle=(a:Item,b:Item)=>a.created_at.localeCompare(b.created_at)||a.title.localeCompare(b.title,"es")||a.id.localeCompare(b.id);

/**
 * A read-only projection of the same records that power GOI Tree.
 * MVP edges are:
 * opportunity -> hypothesis (parent_id),
 * hypothesis -> experiment (fields.mvp_hypothesis_id),
 * opportunity/hypothesis -> research (fields.mvp_links, many-to-many).
 * No record is cloned, moved, or persisted by this function.
 */
export function getMvpHierarchy(items:Item[], view:MvpHierarchyView){
 const local=items.filter(item=>displayKinds.has(item.kind));
 const byId=new Map(local.map(item=>[item.id,item]));
 const parents=new Map<string,Item[]>();
 const childrenIndex=new Map<string,Item[]>();
 const link=(child:Item,parentId:string|null|undefined,kind:Item["kind"]|Item["kind"][])=>{
  if(!parentId)return;
  const parent=byId.get(parentId);
  if(!parent||parent.project_id!==child.project_id||!(Array.isArray(kind)?kind.includes(parent.kind):parent.kind===kind))return;
  if(!parents.has(child.id))parents.set(child.id,[]);
  if(!childrenIndex.has(parent.id))childrenIndex.set(parent.id,[]);
  if(!parents.get(child.id)!.some(p=>p.id===parent.id))parents.get(child.id)!.push(parent);
  if(!childrenIndex.get(parent.id)!.some(c=>c.id===child.id))childrenIndex.get(parent.id)!.push(child);
 };
 for(const item of local){
  if(item.kind==="hypothesis")link(item,item.parent_id,"opportunity");
  if(item.kind==="experiment")link(item,linkedHypothesis(item),"hypothesis");
  if(item.kind==="research"){
   for(const id of linkedResearchIds(item))link(item,id,["opportunity","hypothesis"]);
  }
 }
 const desiredKind:Item["kind"]=
  view==="mvp_problems"?"opportunity":view==="mvp_hypotheses"?"hypothesis":
  view==="mvp_experiments"?"experiment":"research";
 const target=local.filter(item=>item.kind===desiredKind);
 const included=new Set(target.map(item=>item.id));
 const expanded=new Set<string>();
 // Make each selected kind and all ancestors visible on arrival, while
 // keeping levels beneath the selected kind folded (matching GOI Tree).
 function addAncestors(id:string,path:Set<string>){
  for(const parent of parents.get(id)||[]){
   if(path.has(parent.id))continue;
   included.add(parent.id);expanded.add(parent.id);
   addAncestors(parent.id,new Set([...path,parent.id]));
  }
 }
 for(const item of target)addAncestors(item.id,new Set([item.id]));
 function includeDescendants(id:string,path:Set<string>){
  for(const child of childrenIndex.get(id)||[]){
   if(path.has(child.id))continue;
   included.add(child.id);
   includeDescendants(child.id,new Set([...path,child.id]));
  }
 }
 for(const item of target)includeDescendants(item.id,new Set([item.id]));
 const children=(parentId:string):Item[] => (childrenIndex.get(parentId)||[])
  .filter(item=>included.has(item.id)).sort(byDateAndTitle);
 const roots=local.filter(item=>included.has(item.id) &&
  !(parents.get(item.id)||[]).some(parent=>included.has(parent.id))).sort(byDateAndTitle);
 const unlinked=roots.filter(item=>item.kind!=="opportunity");
 const unlinkedIds=new Set(unlinked.map(item=>item.id));
 return {target,roots:roots.filter(item=>!unlinkedIds.has(item.id)),unlinked,children,expanded,parents};
}

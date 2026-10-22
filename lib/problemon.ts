import type {Item} from "./model";

/** Problemon uses the existing shared opportunity row (not a new record kind). */
export function isProblemon(item:Pick<Item,"kind"|"fields">):boolean {
 return item.kind==="opportunity" && (item.fields.is_problemon===true || item.fields.is_problemon==="true");
}
export function getProblemon(items:Item[],projectId:string):Item|null {
 return items.find(item=>item.project_id===projectId&&isProblemon(item))||null;
}
export function getProblemonCandidates(items:Item[],projectId:string):Item[] {
 return items.filter(item=>item.project_id===projectId&&item.kind==="opportunity"&&!isProblemon(item))
  .sort((a,b)=>a.title.localeCompare(b.title,"es")||a.id.localeCompare(b.id));
}

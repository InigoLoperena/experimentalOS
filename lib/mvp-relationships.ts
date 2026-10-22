import type { Item } from "./model";
export function linkedHypothesis(experiment:Pick<Item,"fields"> & Partial<Pick<Item,"parent_id">>):string{
 return String(experiment.parent_id || experiment.fields.mvp_hypothesis_id || "").trim();
}
export function linkedResearchIds(research:Pick<Item,"fields">):string[]{
 return [...new Set(String(research.fields.mvp_links||"").split(",").map(v=>v.trim()).filter(Boolean))];
}
/** Both workflows display the same record IDs. Focus is strictly view-only. */
export function buildMvpBoard(records:Item[],projectId:string,problemId:string|null=null,hypothesisId:string|null=null){
 const items=records.filter(item=>item.project_id===projectId);
 const problems=items.filter(item=>item.kind==="opportunity");
 const hypotheses=items.filter(item=>item.kind==="hypothesis");
 const experiments=items.filter(item=>item.kind==="experiment");
 const research=items.filter(item=>item.kind==="research");
 const problemIds=new Set(problems.map(item=>item.id));
 const hypothesisIds=new Set(hypotheses.map(item=>item.id));
 const selectedProblem=problems.find(item=>item.id===problemId)||null;
 const selectedHypothesis=hypotheses.find(item=>item.id===hypothesisId&&(!selectedProblem||item.parent_id===selectedProblem.id))||null;
 const visibleHypotheses=selectedProblem?hypotheses.filter(item=>item.parent_id===selectedProblem.id):hypotheses;
 const visibleExperiments=selectedHypothesis?experiments.filter(item=>linkedHypothesis(item)===selectedHypothesis.id)
   :selectedProblem?experiments.filter(item=>hypotheses.some(h=>h.parent_id===selectedProblem.id&&h.id===linkedHypothesis(item))):experiments;
 return{items,problems,hypotheses,experiments,research,problemIds,hypothesisIds,selectedProblem,selectedHypothesis,visibleHypotheses,visibleExperiments,
  orphanHypotheses:hypotheses.filter(item=>!problemIds.has(item.parent_id||"")),
  orphanExperiments:experiments.filter(item=>!hypothesisIds.has(linkedHypothesis(item)))};
}

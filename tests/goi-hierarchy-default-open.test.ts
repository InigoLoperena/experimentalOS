import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {getGoiHierarchy} from "../lib/goi-hierarchy";
import type {Item,Kind} from "../lib/model";

function sample(id:string,kind:Kind,parent_id:string|null=null,goi_section?:string):Item {
 return {id,kind,parent_id,project_id:"project",workspace_id:"ws",related_id:null,
  title:id,owner_id:null,created_at:"2026-10-17T00:00:00Z",updated_at:"2026-10-17T00:00:00Z",
  created_by:null,updated_by:null,fields:goi_section?{goi_section}:{}};
}
const records=[
 sample("nsm","north_star"),
 sample("goal","goal","nsm"),
 sample("input","goal","nsm","input_metrics"),
 sample("opportunity","opportunity","goal"),
 sample("secondOpportunity","opportunity","goal"),
 sample("idea","hypothesis","opportunity"),
 sample("secondIdea","hypothesis","opportunity"),
 sample("experiment","experiment","idea"),
 sample("otherExperiment","experiment","secondIdea"),
 sample("metricOpportunity","opportunity","input"),
];

function initiallyVisible(view:"goals"|"input_metrics"|"opportunities"|"ideas") {
 const h=getGoiHierarchy(records,view);
 const seen:string[]=[];
 const traverse=(id:string,visited=new Set<string>())=>{
  if(visited.has(id))throw new Error("Duplicate node: "+id);
  const updated=new Set(visited);updated.add(id);seen.push(id);
  if(h.expanded.has(id))for(const child of h.children(id))traverse(child.id,updated);
 };
 h.roots.forEach(root=>traverse(root.id));
 return {h,seen};
}

test("Oportunidades shows each goal and its problems without opening hypotheses",()=>{
 const {h,seen}=initiallyVisible("opportunities");
 assert.deepEqual(seen,["goal","opportunity","secondOpportunity","input","metricOpportunity"]);
 assert.ok(h.expanded.has("goal"));
 assert.ok(h.expanded.has("input"));
 assert.ok(!h.expanded.has("opportunity"));
 assert.ok(!seen.includes("idea"));
 assert.ok(!seen.includes("nsm"));
});

test("Hipótesis shows ancestor goals and problems plus the hypotheses, but not experiments",()=>{
 const {h,seen}=initiallyVisible("ideas");
 assert.deepEqual(seen,["goal","opportunity","idea","secondIdea"]);
 assert.ok(h.expanded.has("goal")&&h.expanded.has("opportunity"));
 assert.ok(!h.expanded.has("idea"));
 assert.deepEqual(h.children("idea").map(i=>i.id),["experiment"]);
 assert.equal(new Set(seen).size,seen.length);
});

test("Goals and Input Metrics only expand when a reader requests descendants",()=>{
 for(const [view,root] of [["goals","goal"],["input_metrics","input"]] as const){
  const {h,seen}=initiallyVisible(view);
  assert.deepEqual(seen,[root]);
  assert.equal(h.expanded.size,0);
  assert.ok(h.children(root).length>0);
 }
});

test("native details use the selected hierarchy ancestor expansion by default",async()=>{
 const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
 assert.match(page,/getGoiHierarchy\(items, view/);
 assert.match(page,/<details key=\{view \+ ":" \+ item\.id\} className="goi-hierarchy-toggle" open=\{expanded\.has\(item\.id\)\}/);
});

test("Unassigned opportunities appear in their own first-position group on Problems and Hypotheses",()=>{
 const fixture=[
  ...records,
  sample("orphanProblem","opportunity"),
  sample("orphanProblemWithMissingParent","opportunity","deletedGoal"),
  sample("ideaUnderOrphanProblem","hypothesis","orphanProblem"),
  sample("orphanIdea","hypothesis"),
  sample("experimentUnderOrphanIdea","experiment","orphanIdea"),
 ];
 for (const view of ["opportunities","ideas"] as const) {
  const h=getGoiHierarchy(fixture,view);
  assert.deepEqual(h.orphanOpportunities.map(x=>x.id),["orphanProblem","orphanProblemWithMissingParent"]);
  assert.ok(h.roots.every(x=>!h.orphanOpportunities.some(y=>y.id===x.id)));
  assert.deepEqual(h.children("orphanProblem").map(x=>x.id),["ideaUnderOrphanProblem"]);
 }
 const ideas=getGoiHierarchy(fixture,"ideas");
 assert.deepEqual(ideas.orphanHypotheses.map(x=>x.id),["orphanIdea"]);
 assert.ok(!ideas.roots.some(x=>x.id==="orphanIdea"));
 assert.deepEqual(ideas.children("orphanIdea").map(x=>x.id),["experimentUnderOrphanIdea"]);
 const problems=getGoiHierarchy(fixture,"opportunities");
 assert.equal(problems.orphanHypotheses.length,0);
 assert.ok(problems.roots.some(x=>x.id==="goal"));
});

test("Orphaned opportunity cards appear in Hipótesis even if no ideas exist yet",()=>{
 const h=getGoiHierarchy([sample("orphan","opportunity")],"ideas");
 assert.equal(h.target.length,0);
 assert.deepEqual(h.orphanOpportunities.map(x=>x.id),["orphan"]);
 assert.deepEqual(h.roots,[]);
});

test("Orphan groups precede regular GOI branches in both subsection views",async()=>{
 const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
 const start=page.indexOf('aria-label="Oportunidades-problemas huérfanos"');
 const ideas=page.indexOf('aria-label="Hipótesis huérfanas"');
 const regular=page.indexOf("{roots.map(renderGroup)}");
 assert.ok(start > 0 && ideas > start && regular > ideas);
 assert.match(page,/orphanOpportunities\.map\(renderGroup\)/);
 assert.match(page,/orphanHypotheses\.map\(renderGroup\)/);
});

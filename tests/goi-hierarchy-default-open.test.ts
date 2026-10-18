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
 sample("idea","idea","opportunity"),
 sample("secondIdea","idea","opportunity"),
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

test("Oportunidades shows each goal and its problems without opening ideas",()=>{
 const {h,seen}=initiallyVisible("opportunities");
 assert.deepEqual(seen,["goal","opportunity","secondOpportunity","input","metricOpportunity"]);
 assert.ok(h.expanded.has("goal"));
 assert.ok(h.expanded.has("input"));
 assert.ok(!h.expanded.has("opportunity"));
 assert.ok(!seen.includes("idea"));
 assert.ok(!seen.includes("nsm"));
});

test("Ideas shows ancestor goals and problems plus the ideas, but not experiments",()=>{
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

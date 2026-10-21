import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { kinds, parents, validate, type Item } from "../lib/model";
import { cleanExperimentFields, normalizeExperiment } from "../lib/experiments";
import { supportsAttachments } from "../lib/attachments";
import { sectionPaths, viewForPath } from "../lib/section-routes";
import { buildMvpBoard, linkedResearchIds } from "../lib/mvp-relationships";

const record = (kind:Item["kind"],fields:Item["fields"]={}) =>
 ({kind,title:"Prueba",parent_id:null,fields});

test("MVP modules coexist with GOI, using new kinds but shared opportunity and experiment records", () => {
 assert.equal(sectionPaths.mvp,"/experimentacion-mvps");
 assert.equal(viewForPath("/goi-tree"),"map");
 assert.equal(viewForPath("/goi-tree/oportunidades"),"opportunities");
 assert.equal(viewForPath("/experimentos"),"experiments");
 assert.equal(kinds.hypothesis,"Hipótesis");
 assert.equal(kinds.research,"Investigación");
 assert.equal(parents.hypothesis,"opportunity");
 assert.equal(parents.research,null);
 assert.equal(validate(record("hypothesis")),null);
 assert.equal(validate(record("research")),null);
 assert.ok(supportsAttachments("hypothesis"));
 assert.ok(supportsAttachments("research"));
});

test("The MVP experiment editor never discards GOI, PostHog, or new MVP results and links",()=>{
 const fields={hypothesis:"Old hypothesis",context:"Context",channel:"posthog",
    execution_config:"{}",mvp_hypothesis_id:"hypothesis-1",description:"Description",
    audience:"Travelers",end:"2026-11-20",result:"+14%",learning:"Interesting",decision:"Iterar",impact:5};
 assert.deepEqual(cleanExperimentFields(fields),fields);
 const item={...record("experiment",fields),id:"e",workspace_id:"w",project_id:"p",
 owner_id:null,related_id:null,created_by:null,updated_by:null,created_at:"",updated_at:""} as Item;
 assert.equal(normalizeExperiment(item).fields.mvp_hypothesis_id,"hypothesis-1");
 assert.equal(normalizeExperiment(item).fields.execution_config,"{}");
});

test("The MVP board displays both modules through the existing CRUD, including unmatched experiments",async()=>{
 const [page,component,migration] = await Promise.all([
  readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/mvp-experimentation.tsx",import.meta.url),"utf8"),
  readFile(new URL("../supabase/migrations/20261021163000_mvp_experimentation.sql",import.meta.url),"utf8")
 ]);
 assert.match(page,/view === "mvp" && currentProject/);
 assert.match(page,/items=\{items\}/);
 assert.match(page,/onCreate=\{createMvp\}/);
 assert.match(page,/onDelete=\{item => void deleteRecord\(item\)\}/);
 assert.match(component,/Experimentos sin hipótesis/);
 assert.match(component,/Hipótesis sin problema/);
 assert.match(component,/linkedResearchIds\(item\)/);
 assert.match(migration,/create trigger zz_mvp_record_links/);
 assert.match(migration,/create trigger zz_cleanup_mvp_links/);
 assert.match(migration,/''hypothesis'' then ''opportunity''/);
 assert.doesNotMatch(migration,/drop table public\.records/i);
});

test("MVP relationships keep shared IDs, orphans and project isolation",()=>{
 const r=(id:string,kind:Item["kind"],project_id:string,parent_id:string|null=null,fields:Item["fields"]={}):Item=>({
  id,kind,project_id,parent_id,fields,title:id,workspace_id:"w",related_id:null,owner_id:null,created_by:null,updated_by:null,created_at:"",updated_at:""
 });
 const source=[
  r("o1","opportunity","p"),r("o2","opportunity","p"),r("h1","hypothesis","p","o1"),r("h2","hypothesis","p","o2"),
  r("hx","hypothesis","p"),r("e1","experiment","p",null,{mvp_hypothesis_id:"h1"}),
  r("e2","experiment","p",null,{mvp_hypothesis_id:"h2"}),r("ex","experiment","p"),
  r("research","research","p",null,{mvp_links:"o1,h1,o1"}),
  r("other","experiment","other",null,{mvp_hypothesis_id:"h1"}),
 ];
 const all=buildMvpBoard(source,"p");
 assert.equal(all.problems.length,2);
 assert.equal(all.hypotheses.length,3);
 assert.equal(all.experiments.length,3);
 assert.equal(all.research.length,1);
 assert.deepEqual(all.orphanHypotheses.map(x=>x.id),["hx"]);
 assert.deepEqual(all.orphanExperiments.map(x=>x.id),["ex"]);
 assert.deepEqual(linkedResearchIds(source[8]),["o1","h1"]);
 assert.deepEqual(buildMvpBoard(source,"p","o1").visibleHypotheses.map(x=>x.id),["h1"]);
 assert.deepEqual(buildMvpBoard(source,"p","o1").visibleExperiments.map(x=>x.id),["e1"]);
 assert.deepEqual(buildMvpBoard(source,"p",null,"h2").visibleExperiments.map(x=>x.id),["e2"]);
 assert.equal(buildMvpBoard(source,"p","o1","h2").selectedHypothesis,null);
 assert.equal(buildMvpBoard(source,"other").experiments.length,1);
});
test("MVP board has four colored lanes and preserves GOI visual and edit routes",async()=>{
 const [component,styles,page]=await Promise.all([
  readFile(new URL("../app/mvp-experimentation.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
 ]);
 for(const lane of ["research","problems","hypotheses","experiments"]){
  assert.ok(component.includes("mvp-lane-"+lane));
  assert.ok(styles.includes(".mvp-lane-"+lane));
 }
 assert.match(component,/readOnly&&canEdit/);
 assert.match(component,/canDelete\(item.kind\)/);
 assert.match(component,/aria-pressed=\{selected\}/);
 assert.match(component,/buildMvpBoard\(items,project.id/);
 assert.match(page,/view === "map" && currentProject/);
 assert.match(page,/view === "mvp" && currentProject/);
});

test("MVP subsection hierarchy preserves the same shared records, parents, descendants and research links",async()=>{
 const {getMvpHierarchy}=await import("../lib/mvp-hierarchy");
 const mk=(id:string,kind:Item["kind"],parent_id:string|null=null,fields:Item["fields"]={},project_id="p"):Item=>({
  id,kind,workspace_id:"w",project_id,parent_id,related_id:null,title:id,owner_id:null,
  created_at:"",updated_at:"",created_by:null,updated_by:null,fields
 });
 const example=[
  mk("goal","goal"),mk("problem","opportunity","goal"),mk("other","opportunity"),
  mk("hypothesis","hypothesis","problem"),mk("orphanHypothesis","hypothesis"),
  mk("experiment","experiment",null,{mvp_hypothesis_id:"hypothesis"}),
  mk("orphanExperiment","experiment"),
  mk("research","research",null,{mvp_links:"problem,hypothesis"}),
  mk("unlinkedResearch","research"),mk("outsider","experiment",null,{},"outside"),
 ];
 const problemHierarchy=getMvpHierarchy(example,"mvp_problems");
 assert.equal(problemHierarchy.roots[0],example[1]); // shared reference, not copied
 assert.deepEqual(problemHierarchy.children("problem").map(x=>x.id),["hypothesis","research"]);
 assert.deepEqual(problemHierarchy.children("hypothesis").map(x=>x.id),["experiment","research"]);
 assert.equal(problemHierarchy.expanded.size,0); // top-level children initially collapsed
 const hypothesisHierarchy=getMvpHierarchy(example,"mvp_hypotheses");
 assert.ok(hypothesisHierarchy.expanded.has("problem"));
 assert.ok(!hypothesisHierarchy.expanded.has("hypothesis"));
 assert.deepEqual(hypothesisHierarchy.unlinked.map(x=>x.id),["orphanHypothesis"]);
 const experimentHierarchy=getMvpHierarchy(example,"mvp_experiments");
 assert.ok(experimentHierarchy.expanded.has("problem"));
 assert.ok(experimentHierarchy.expanded.has("hypothesis"));
 assert.deepEqual(experimentHierarchy.unlinked.map(x=>x.id),["orphanExperiment"]);
 const researchHierarchy=getMvpHierarchy(example,"mvp_research");
 assert.ok(researchHierarchy.children("hypothesis").some(x=>x.id==="research"));
 assert.deepEqual(researchHierarchy.unlinked.map(x=>x.id),["unlinkedResearch"]);
 assert.equal(experimentHierarchy.target.some(x=>x.id==="outsider"),false);
 assert.equal(problemHierarchy.roots[0],example[1]);
 const {getGoiHierarchy}=await import("../lib/goi-hierarchy");
 const goi=getGoiHierarchy(example,"opportunities");
 assert.equal(goi.target[0],problemHierarchy.target[0]); // one DB record in both systems
});
test("MVP subsections retain separate editable forms and navigation alongside GOI",async()=>{
 const [page,hierarchy,css]=await Promise.all([
  readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/mvp-hierarchy.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/globals.css",import.meta.url),"utf8")
 ]);
 assert.match(page,/nav-mvp-subsections/);
 assert.match(page,/onCreate=\{createMvp\}/);
 assert.match(page,/view=\{view as "mvp_problems"/);
 assert.match(page,/mvp_hypothesis_id: hypothesisId/);
 assert.match(page,/mvp_links: researchTargetId/);
 assert.match(hierarchy,/goi-hierarchy-toggle/);
 assert.match(hierarchy,/querySelectorAll\("details.goi-hierarchy-toggle"\)/);
 assert.match(hierarchy,/Mostrar hijos/);
 assert.match(hierarchy,/Ocultar hijos/);
 assert.match(css,/nav-mvp-subsections/);
});

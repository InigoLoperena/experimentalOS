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

test("MVPs Tree displays the shared GOI records in a visible hierarchical overview",async()=>{
 const [page,component,hierarchy,migration] = await Promise.all([
  readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/mvp-experimentation.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/mvp-hierarchy.tsx",import.meta.url),"utf8"),
  readFile(new URL("../supabase/migrations/20261021163000_mvp_experimentation.sql",import.meta.url),"utf8")
 ]);
 assert.match(page,/view === "mvp" && currentProject/);
 assert.match(page,/items=\{items\}/);
 assert.match(page,/onCreate=\{createMvp\}/);
 assert.match(page,/onDelete=\{item => void deleteRecord\(item\)\}/);
 assert.match(component,/className="mvp-workspace"/);
 assert.doesNotMatch(component,/mvp-project-summary|mvp-tree-path/);
 assert.match(component,/<MvpHierarchy/);
 assert.match(component,/view="mvp"/);
 assert.doesNotMatch(component,/Ver hipótesis/);
 assert.match(hierarchy,/Sin vincular/);
 assert.match(hierarchy,/Mostrar hijos/);
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
test("MVPs Tree reuses GOI's hierarchical disclosures and restricts edits in read-only mode",async()=>{
 const [component,hierarchy,styles,page]=await Promise.all([
  readFile(new URL("../app/mvp-experimentation.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/mvp-hierarchy.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
 ]);
 assert.match(component,/<MvpHierarchy/);
 assert.match(component,/readOnly=\{readOnly\}/);
 assert.match(hierarchy,/!readOnly&&canCreate/);
 assert.match(hierarchy,/!readOnly&&<div className="mvp-hierarchy-actions"/);
 assert.match(hierarchy,/goi-hierarchy-toggle/);
 assert.match(styles,/\.goi-hierarchy-children/);
 assert.match(styles,/\.mvp-hierarchy-experiment\{--node-accent:var\(--experiment-accent\)/);
 assert.match(page,/view === "map" && currentProject/);
 assert.match(page,/view === "mvp" && currentProject/);
 assert.ok(!page.includes('{ id: "experiments", label: "Experimentos", icon: FlaskConical }'));
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
 const problemHierarchy=getMvpHierarchy(example,"mvp_problems","p");
 assert.equal(problemHierarchy.roots.find(x=>x.id==="problem"),example[1]); // shared reference, not copied
 assert.deepEqual(problemHierarchy.children("problem").map(x=>x.id),["hypothesis","research"]);
 assert.deepEqual(problemHierarchy.children("hypothesis").map(x=>x.id),["experiment","research"]);
 assert.equal(problemHierarchy.expanded.size,0); // children hidden by default
 const hypothesisHierarchy=getMvpHierarchy(example,"mvp_hypotheses","p");
 assert.equal(hypothesisHierarchy.expanded.size,0);
 assert.ok(hypothesisHierarchy.children("problem").some(item=>item.id==="hypothesis"));
 assert.deepEqual(hypothesisHierarchy.unlinked.map(x=>x.id),["orphanHypothesis"]);
 const experimentHierarchy=getMvpHierarchy(example,"mvp_experiments","p");
 assert.equal(experimentHierarchy.expanded.size,0);
 assert.ok(experimentHierarchy.children("hypothesis").some(item=>item.id==="experiment"));
 assert.deepEqual(experimentHierarchy.unlinked.map(x=>x.id),["orphanExperiment"]);
 const researchHierarchy=getMvpHierarchy(example,"mvp_research","p");
 assert.ok(researchHierarchy.children("hypothesis").some(x=>x.id==="research"));
 assert.deepEqual(researchHierarchy.unlinked.map(x=>x.id),["unlinkedResearch"]);
 assert.equal(experimentHierarchy.target.some(x=>x.id==="outsider"),false);
 assert.equal(problemHierarchy.roots.find(x=>x.id==="problem"),example[1]);
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
 assert.doesNotMatch(hierarchy,/querySelectorAll\("details.goi-hierarchy-toggle"\)/);
 assert.match(hierarchy,/Mostrar hijos/);
 assert.match(hierarchy,/Ocultar hijos/);
 assert.match(css,/nav-mvp-subsections/);
});

test("MVP links cannot attach records from different projects in hierarchy",async()=>{
 const {getMvpHierarchy}=await import("../lib/mvp-hierarchy");
 const mk=(id:string,kind:Item["kind"],project_id:string,parent_id:string|null,fields:Item["fields"]={}):Item=>({
  id,kind,workspace_id:"w",project_id,parent_id,fields,title:id,owner_id:null,related_id:null,
  created_by:null,updated_by:null,created_at:"",updated_at:""
 });
 const records=[
  mk("problem","opportunity","a",null),
  mk("cross-hypothesis","hypothesis","b","problem"),
  mk("cross-experiment","experiment","a",null,{mvp_hypothesis_id:"cross-hypothesis"}),
  mk("cross-research","research","a",null,{mvp_links:"cross-hypothesis"}),
 ];
 const a=getMvpHierarchy(records,"mvp_experiments","a");
 assert.deepEqual(a.unlinked.map(i=>i.id),["cross-experiment"]);
 assert.equal(a.children("cross-hypothesis").length,0);
 const research=getMvpHierarchy(records,"mvp_research","a");
 assert.deepEqual(research.unlinked.map(i=>i.id),["cross-research"]);
 assert.ok(!research.target.some(i=>i.project_id==="b"));
});

test("MVPs Tree overview preserves nested levels without opening children by default",async()=>{
 const {getMvpHierarchy}=await import("../lib/mvp-hierarchy");
 const mk=(id:string,kind:Item["kind"],parent_id:string|null=null,fields:Item["fields"]={},project_id="one"):Item=>({
  id,kind,parent_id,fields,project_id,workspace_id:"w",title:id,related_id:null,owner_id:null,
  created_by:null,updated_by:null,created_at:"",updated_at:""
 });
 const dataset=[
  mk("problem","opportunity"),
  mk("hypothesis","hypothesis","problem"),
  mk("experiment","experiment",null,{mvp_hypothesis_id:"hypothesis"}),
  mk("investigation","research",null,{mvp_links:"hypothesis"}),
  mk("unlinkedExperiment","experiment"),
  mk("external","experiment",null,{mvp_hypothesis_id:"hypothesis"},"other")
 ];
 const view=getMvpHierarchy(dataset,"mvp","one");
 assert.deepEqual(view.target.map(x=>x.id),["problem","hypothesis","experiment","investigation","unlinkedExperiment"]);
 assert.deepEqual(view.roots.map(x=>x.id),["problem"]);
 assert.deepEqual(view.children("problem").map(x=>x.id),["hypothesis"]);
 assert.deepEqual(view.children("hypothesis").map(x=>x.id),["experiment","investigation"]);
 assert.equal(view.expanded.size,0);
 assert.ok(view.children("hypothesis").some(item=>item.id==="experiment"));
 assert.deepEqual(view.unlinked.map(x=>x.id),["unlinkedExperiment"]);
 assert.equal(view.children("problem")[0],dataset[1]);
});

test("Experiments live only under MVPs Tree and GOI Tree with a unified purple accent",async()=>{
 const [page,css,routes]=await Promise.all([
  readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  import("../lib/section-routes")
 ]);
 assert.ok(page.includes('{ id: "mvp", label: "MVPs Tree", icon: Microscope }'));
 assert.doesNotMatch(page,/\{ id: "experiments", label: "Experimentos", icon: FlaskConical \}/);
 const mvpMenu=page.indexOf('id === "mvp" &&');
 const goiMenu=page.indexOf('id === "map" &&',mvpMenu);
 assert.ok(mvpMenu>0&&goiMenu>mvpMenu);
 const ideas=page.indexOf('navigateView("ideas")',goiMenu);
 const experiments=page.indexOf('navigateView("experiments")',goiMenu);
 assert.ok(ideas>0&&experiments>ideas);
 assert.match(css,/\.mvp-lane-experiments\{--lane:var\(--experiment-accent\)/);
 assert.match(css,/\.mvp-hierarchy-experiment\{--node-accent:var\(--experiment-accent\)/);
 assert.match(css,/nav-goi-subsection\.experiment/);
 assert.equal(routes.sectionPaths.experiments,"/goi-tree/experimentos");
 assert.equal(routes.viewForPath("/experimentos"),"experiments");
});

test("Both MVPs Tree and Growth Tree show hypotheses directly, with parents and children collapsed per row",async()=>{
 const [page,hierarchy,styles]=await Promise.all([
  readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/mvp-hierarchy.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
 ]);
 assert.match(hierarchy,/if\(view==="mvp_hypotheses"\)return/);
 assert.match(hierarchy,/hypotheses\.map\(hypothesis=>/);
 assert.match(hierarchy,/allProjectItems\.filter\(item=>item\.kind==="hypothesis"&&item\.fields\.is_main_hypothesis!==true\)/);
 assert.match(hierarchy,/Desplegar padres e hijos/);
 assert.match(hierarchy,/ancestors\.map\(parentRow\)/);
 assert.match(hierarchy,/descendants\.map\(child=>/);
 assert.match(hierarchy,/openParents\.has\(hypothesis\.id\)/);
 assert.match(page,/view === "ideas" && currentProject/);
 assert.match(page,/view="mvp_hypotheses" treeName="Growth Tree"/);
 assert.match(styles,/mvp-hypothesis-ranked-list/);
 const {getMvpHierarchy}=await import("../lib/mvp-hierarchy");
 const mk=(id:string,kind:Item["kind"],parent_id:string|null=null,fields:Item["fields"]={}):Item=>({
  id,kind,parent_id,fields,project_id:"p",workspace_id:"w",title:id,related_id:null,owner_id:null,
  created_by:null,updated_by:null,created_at:"",updated_at:"",
 });
 const data=[mk("problem","opportunity"),mk("hypothesis","hypothesis","problem",{impact:9,confidence:7,ease:5}),mk("experiment","experiment","hypothesis",{impact:7,confidence:7,ease:7})];
 const result=getMvpHierarchy(data,"mvp_hypotheses","p");
 assert.deepEqual(result.target.map(item=>item.id),["hypothesis"]);
 assert.deepEqual(result.children("hypothesis").map(item=>item.id),["experiment"]);
 assert.equal(result.expanded.size,0);
});

test("Research shows every investigation directly, with expandable and deduplicated parents",async()=>{
 const ui=await readFile(new URL("../app/mvp-hierarchy.tsx",import.meta.url),"utf8");
 assert.match(ui,/if\(view==="mvp_research"\)return/);
 assert.match(ui,/researchRecords\.map\(research=>/);
 assert.match(ui,/allProjectItems\.filter\(item=>item\.kind==="research"\)/);
 assert.match(ui,/researchParentsOf\(research\)/);
 assert.match(ui,/hierarchy\.parents\.get\(research\.id\)/);
 assert.match(ui,/openParents\.has\(research\.id\)/);
 assert.match(ui,/Desplegar padres/);
 assert.match(ui,/ancestors\.map\(parentRow\)/);
 assert.match(ui,/Este proyecto todavía no tiene investigaciones/);
 const {getMvpHierarchy}=await import("../lib/mvp-hierarchy");
 const mk=(id:string,kind:Item["kind"],projectId="p",parent:string|null=null,fields:Item["fields"]={}):Item=>({
  id,kind,project_id:projectId,parent_id:parent,fields,workspace_id:"w",title:id,related_id:null,
  owner_id:null,created_by:null,updated_by:null,created_at:"",updated_at:""
 });
 const source=[
  mk("problem","opportunity"),mk("hypothesis","hypothesis","p","problem"),
  mk("multi","research","p",null,{mvp_links:"problem,hypothesis,problem"}),
  mk("direct","research","p",null,{mvp_links:"problem"}),
  mk("unlinked","research"),
  mk("externalProblem","opportunity","other"),
  mk("cross","research","p",null,{mvp_links:"externalProblem"}),
  mk("foreign","research","other",null,{mvp_links:"problem"})
 ];
 const projection=getMvpHierarchy(source,"mvp_research","p");
 assert.deepEqual(projection.target.map(item=>item.id),["multi","direct","unlinked","cross"]);
 assert.deepEqual(projection.parents.get("multi")?.map(item=>item.id),["problem","hypothesis"]);
 assert.deepEqual(projection.parents.get("direct")?.map(item=>item.id),["problem"]);
 assert.equal(projection.parents.has("unlinked"),false);
 assert.equal(projection.parents.has("cross"),false);
 assert.ok(projection.target.every(item=>item.project_id==="p"));
});

test("Growth Tree and MVPs Tree use the same experiment fields, editable ICE and save path",async()=>{
 const [page,model]=await Promise.all([
  readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
  import("../lib/experiments")
 ]);
 const expected=[
  "context","description","hypothesis","audience","metric","success_criteria",
  "secondary_metrics","traffic_plan","risks","start","end","result","learning",
  "decision","tags","impact","confidence","ease"
 ];
 const fields=model.experimentFields.map(field=>field.key);
 for(const field of expected)assert.ok(fields.includes(field),`Missing experiment field ${field}`);
 assert.equal(new Set(fields).size,fields.length,"No duplicate fields in shared editor");
 const ice=["impact","confidence","ease"];
 for(const key of ice) {
  const field=model.experimentFields.find(f=>f.key===key);
  assert.equal(field?.type,"number");
  assert.ok(model.experimentSections.ice.some(f=>f.key===key));
 }
 assert.match(page,/experiment: experimentFields/);
 // The old MVP-only experiment schema hid ICE and common Growth fields.
 assert.doesNotMatch(page,/experiment:\s*\[\s*\{ key: "description", label: "Descripción"/);
 assert.match(page,/draft\.kind === "experiment" \? experimentEditorFields/);
 assert.deepEqual(model.experimentEditorFields.map(field=>field.key),["context","description","audience","metric","success_criteria"]);
 assert.match(page,/setMvpEditor\(kind !== "experiment"\)/);
 assert.match(page,/setMvpEditor\(record\.kind !== "experiment"\)/);
 assert.doesNotMatch(page,/selected\.kind === "experiment" && !mvpEditor/);
 assert.match(page,/selected\.kind === "experiment" \? <>/);
 assert.match(page,/<FieldDetails record=\{selected\} fields=\{experimentSections\.primary\} \/>/);
 assert.match(page,/<FieldDetails record=\{selected\} fields=\{experimentSections\.ice\} \/>/);
 assert.match(page,/draft\.kind !== "experiment" \|\| f\.key !== "posthog_experiment_id"/);
 assert.doesNotMatch(page,/\!\['impact','confidence','ease'\]\.includes\(f\.key\)/);
 assert.match(page,/record\.kind==='experiment' \? supabase!\.rpc\('save_experiment_preparation'/);
 assert.match(page,/await load\(\)/);
});

test("Editing ICE from either tree preserves original experiment content and relationships",()=>{
 const originalFields={
  context:"Own context",description:"Own description",audience:"Users",hypothesis:"Test",
  metric:"Clicks",success_criteria:"10 clicks",result:"Qualitative results",
  decision:"Iterar",mvp_hypothesis_id:"hypothesis-id",impact:5,confidence:5,ease:5
 };
 const experiment={...record("experiment",originalFields),id:"existing"} as Item;
 const nextFields:Item["fields"]={...experiment.fields,impact:9,confidence:8,ease:7};
 assert.equal(validate({...experiment,fields:nextFields}),null);
 assert.equal(nextFields.mvp_hypothesis_id,"hypothesis-id");
 assert.deepEqual(normalizeExperiment({...experiment,fields:nextFields}).fields,nextFields);
 assert.equal(nextFields.description,originalFields.description);
 assert.equal(nextFields.result,originalFields.result);
 assert.equal(validate({...experiment,fields:{...nextFields,ease:11}}),"Las puntuaciones ICE deben ser enteros entre 1 y 10.");
});

test("The principal hypothesis exists only in its own list, preserving its experiment associations",async()=>{
 const {getMvpHierarchy}=await import("../lib/mvp-hierarchy");
 const mk=(id:string,kind:Item["kind"],parent_id:string|null=null,fields:Item["fields"]={},project_id="p"):Item=>({
  id,kind,fields,parent_id,project_id,workspace_id:"w",title:id,related_id:null,owner_id:null,
  created_by:null,updated_by:null,created_at:"",updated_at:""
 });
 const problem=mk("principal-problem","opportunity",null,{is_problemon:true});
 const main=mk("principal-hypothesis","hypothesis",problem.id,{is_main_hypothesis:true,impact:9,confidence:9,ease:8});
 const ordinary=mk("ordinary-hypothesis","hypothesis",problem.id,{impact:5,confidence:5,ease:5});
 const experimental=mk("experiment","experiment",main.id,{mvp_hypothesis_id:main.id});
 const data=[problem,main,ordinary,experimental,mk("unrelated","hypothesis",null,{},"elsewhere")];
 const ordinaryList=getMvpHierarchy(data,"mvp_hypotheses","p");
 assert.deepEqual(ordinaryList.target.map(x=>x.id),["ordinary-hypothesis"]);
 assert.ok(!ordinaryList.target.includes(main));
 const principalView=getMvpHierarchy(data,"mvp_main_hypothesis","p");
 assert.deepEqual(principalView.target.map(x=>x.id),["principal-hypothesis"]);
 const experimentView=getMvpHierarchy(data,"mvp_experiments","p");
 assert.equal(experimentView.parents.get("experiment")?.[0]?.id,main.id);
 assert.ok(experimentView.children(main.id).includes(experimental));
 const src=await readFile(new URL("../app/mvp-hierarchy.tsx",import.meta.url),"utf8");
 assert.match(src,/allProjectItems\.filter\(item=>item\.kind==="hypothesis"&&item\.fields\.is_main_hypothesis!==true\)/);
 assert.match(src,/view==="mvp_hypotheses"/);
 assert.match(src,/view==="mvp_main_hypothesis"/);
});

test("Expanded details show one colored title and exactly one parent relation for every record type",async()=>{
 const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
 const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
 const first=page.indexOf('<div className="detail-content">');
 const last=page.indexOf('</dialog>',first);
 assert.ok(first>0&&last>first);
 const detail=page.slice(first,last);
 assert.match(page,/function detailTitleTag\(item: Item\)/);
 assert.match(page,/if \(\["goal", "opportunity", "hypothesis"\]\.includes\(item\.kind\)\) return goiTitleTag\(item\)/);
 assert.match(page,/if \(item\.kind === "experiment"\) return experimentTag\(item\)/);
 assert.match(page,/<span className=\{`detail-record-title kind/);
 assert.equal((detail.match(/detailTitleTag\(selected\)/g)||[]).length,1);
 assert.match(detail,/className="detail-heading" role="heading" aria-level=\{2\}/);
 assert.equal((detail.match(/<div className="record-relation"/g)||[]).length,1);
 assert.doesNotMatch(detail,/className="breadcrumb"/);
 assert.doesNotMatch(detail,/className="experiment-detail-title"/);
 assert.doesNotMatch(detail,/className="hypothesis-detail-title"/);
 assert.doesNotMatch(detail,/<h2>\{selected\.title\}<\/h2>/);
 assert.match(css,/\.detail-identity-row/);
 assert.match(css,/\.detail-record-title/);
});

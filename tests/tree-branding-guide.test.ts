import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const get=(path:string)=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("Growth Tree is the only visible tree name, while stable GOI routes stay usable", async()=>{
 const [page,hierarchy,ai,guide,layout,routes]=await Promise.all([
  get("app/page.tsx"),get("app/mvp-hierarchy.tsx"),
  get("app/strategic-ai.tsx"),get("app/guia-investigacion/page.tsx"),
  get("app/layout.tsx"),import("../lib/section-routes"),
 ]);
 assert.ok(page.includes('{ id: "map", label: "Growth Tree", icon: GitBranch }'));
 assert.ok(page.includes('{ id: "mvp", label: "MVPs Tree", icon: Microscope }'));
 for(const source of [page,hierarchy,ai,guide,layout]){
  assert.doesNotMatch(source,/GOI Tree/);
 }
 assert.equal(routes.sectionPaths.map,"/goi-tree");
 assert.equal(routes.viewForPath("/goi-tree/hipotesis"),"ideas");
 assert.equal(routes.viewForPath("/goi-tree/ideas"),"ideas");
 assert.equal(routes.viewForPath("/goi-tree/experimentos"),"experiments");
});

test("MVPs Tree counter covers shared problems, hypotheses, investigations and experiments once per project",async()=>{
 const page=await get("app/page.tsx");
 assert.match(page,/const mvpTreeCount = items\.filter\(i =>\s*\["opportunity", "hypothesis", "research", "experiment"\]\.includes\(i\.kind\)/);
 assert.match(page,/id === "mvp" && \(\s*<span className="nav-count"/);
 assert.match(page,/\{mvpTreeCount\}/);
 assert.match(page,/id === "map" && \(\s*<span className="nav-count"/);
 assert.match(page,/const items = workspaceItems\.filter/);
});

test("Hypothesis is consistently yellow with lightbulb in navigation, tree, stage, details and edit form",async()=>{
 const [page,css,mvp,hierarchy]=await Promise.all([
  get("app/page.tsx"),get("app/globals.css"),
  get("app/mvp-experimentation.tsx"),get("app/mvp-hierarchy.tsx"),
 ]);
 assert.match(css,/:root\{--hypothesis-accent:#ffd84d/);
 for(const line of [
   ".mvp-lane-hypotheses{--lane:var(--hypothesis-accent)",
   ".mvp-hierarchy-hypothesis{--node-accent:var(--hypothesis-accent)",
   ".nav-mvp-subsection.hypotheses{color:var(--hypothesis-accent)",
   ".mvp-tree-path span:nth-child(3){color:var(--hypothesis-accent)",
   ".kind.hypothesis{color:var(--hypothesis-accent)"
 ])assert.ok(css.includes(line),"Missing yellow style: "+line);
 assert.match(page,/kind === "hypothesis"\s*\? Lightbulb/);
 assert.match(page,/detailTitleTag\(selected\)/);\n assert.match(page,/if \(\["goal", "opportunity", "hypothesis"\]\.includes\(item\.kind\)\) return goiTitleTag\(item\)/);\n assert.match(css,/\.goi-title-tag\.hypothesis\{color:var\(--hypothesis-accent\)/);
 assert.match(page,/draft.kind === "hypothesis" && <Lightbulb/);
 assert.match(mvp,/<Lightbulb size=\{16\} aria-hidden="true"\/> Hipótesis/);
 assert.match(hierarchy,/kind==="hypothesis"\)return <Lightbulb/);
 assert.match(css,/\.mvp-lane-experiments\{--lane:var\(--experiment-accent\)/);
});

test("How to use guide teaches MVPs Tree second and Growth Tree third, with shared records and follow-up steps",async()=>{
 const page=await get("app/page.tsx");
 const guide=page.slice(page.indexOf("function Method() {"),page.indexOf("function IceGuide() {"));
 const titles=[
  "1. Empieza por un proyecto",
  "2. Descubre y valida en MVPs Tree",
  "3. Organiza el crecimiento en Growth Tree",
  "4. Investiga y consulta la IA del proyecto",
  "5. Diseña un experimento verificable",
  "6. Guarda y reutiliza los aprendizajes",
 ];
 let last=-1;
 for(const title of titles){
  const position=guide.indexOf(title);
  assert.ok(position>last,"Guide step is absent or out of order: "+title);
  last=position;
 }
 assert.match(guide,/Problemas u Oportunidades/);
 assert.match(guide,/Hipótesis/);
 assert.match(guide,/Investigación/);
 assert.match(guide,/Experimentos/);
 assert.match(guide,/Cómo se conectan ambos árboles/);
 assert.match(guide,/No se duplican datos/);
 assert.match(guide,/hipótesis no se confirma/);
 assert.match(guide,/href="\/experimentacion-mvps"/);
 assert.match(guide,/href="\/goi-tree"/);
});

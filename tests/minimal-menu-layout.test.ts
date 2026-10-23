import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=(path:string)=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("All app sections have one page title without redundant laboratory captions or introductory copy",async()=>{
 const page=await read("app/page.tsx");
 const start=page.indexOf('<div className="page-heading">');
 const end=page.indexOf('{error && !draft',start);
 assert.ok(start!==-1&&end>start);
 const heading=page.slice(start,end);
 assert.match(heading,/className="minimal-section-title"/);
 assert.equal((heading.match(/<h1/g)||[]).length,1);
 assert.match(heading,/style=\{\{color:sectionHeadings\[view\]\.color\}\}/);
 assert.match(heading,/<CurrentSectionIcon size=\{27\} aria-hidden="true"\/>/);
 assert.doesNotMatch(heading,/ESTRATEGIA EN ACCIÓN|LABORATORIO/);
 assert.doesNotMatch(heading,/<p>/);
 assert.doesNotMatch(page,/Growth Tree · \{currentProject\.title\}/);
 assert.doesNotMatch(page,/Hijos directos de North Star Metric/);
});

test("Principal problem is a single large flagged title with only stored description and optional child toggle",async()=>{
 const [component,css,page]=await Promise.all([
  read("app/problemon-section.tsx"),read("app/globals.css"),read("app/page.tsx")
 ]);
 assert.doesNotMatch(component,/className="problemon-header"|className="problemon-meta"/);
 assert.doesNotMatch(component,/Problema u oportunidad principal|Una única oportunidad principal/);
 assert.match(component,/className="problemon-primary-title"/);
 assert.match(component,/<Flag size=\{21\} color="var\(--red-text\)"/);
 assert.match(component,/selected\.title/);
 assert.match(component,/String\(selected\.fields\.description\|\|""\)\.trim\(\)/);
 assert.match(component,/getMvpHierarchy\(items,"mvp",project\.id\)/);
 assert.match(component,/Mostrar hijos/);
 assert.match(component,/onEdit\(selected\)/);
 assert.match(component,/onCreate\}/);
 assert.match(css,/\.problemon-primary \.problemon-primary-title/);
 assert.match(page,/\{\(\["problemon","mvp_problemon"\] as View\[\]\)\.includes\(view\) && currentProject && renderProblemon\(\)\}/);
});

test("MVPs Tree subsections and overview do not repeat page titles or explain the tree",async()=>{
 const [hierarchy,overview]=await Promise.all([read("app/mvp-hierarchy.tsx"),read("app/mvp-experimentation.tsx")]);
 assert.doesNotMatch(hierarchy,/className="mvp-hierarchy-heading panel"/);
 assert.doesNotMatch(hierarchy,/<p>\{meta\.description\}<\/p>/);
 assert.match(hierarchy,/className="mvp-section-actions"/);
 assert.doesNotMatch(hierarchy,/\{description&&<p>\{description\}<\/p>\}/);
 assert.match(hierarchy,/view==="mvp_hypotheses"/);
 assert.match(hierarchy,/view==="mvp_research"/);
 assert.match(hierarchy,/view==="mvp_main_hypothesis"/);
 assert.match(hierarchy,/view==="mvp_experiments"/);
 assert.match(hierarchy,/goi-hierarchy-toggle/);
 assert.doesNotMatch(overview,/className="mvp-project-summary"|className="mvp-tree-path"/);
 assert.match(overview,/\{problemonSection\}/);
 assert.match(overview,/onEditProject/);
 assert.match(overview,/view="mvp"/);
});

test("Project descriptions are only displayed when saved by a user",async()=>{
 const page=await read("app/page.tsx");
 assert.match(page,/return String\(project\.fields\.description \|\| ""\)\.trim\(\)/);
 assert.match(page,/projectDescription\(currentProject\) && <p>/);
 assert.match(page,/projectDescription\(p\) && <p className="project-description">/);
 assert.doesNotMatch(page,/Descripción pendiente de completar/);
 assert.doesNotMatch(page,/const northStarDescription/);
 assert.doesNotMatch(page,/project-filter-north-star/);
});

test("Every menu section has its matching color, icon and title (Experimentos without MVPs)",async()=>{
 const [page,css,ai,routes]=await Promise.all([
  read("app/page.tsx"),read("app/globals.css"),
  read("app/strategic-ai.tsx"),read("lib/section-routes.ts"),
 ]);
 const block=page.slice(page.indexOf("const sectionHeadings:"),page.indexOf("const mvpViews ="));
 assert.match(block,/Record<View,\{icon:typeof Compass \| typeof AIBrainIcon;color:string\}>/);
 const pathMap=routes.slice(routes.indexOf("export const sectionPaths"),routes.indexOf("} as const;"));
 const routeKeys=[...pathMap.matchAll(/\b(\w+):\s*'\//g)].map(m=>m[1]);
 assert.ok(routeKeys.length>=20);
 const entryKeys=[...block.matchAll(/^\s*(\w+):\{icon:/gm)].map(m=>m[1]);
 for(const key of routeKeys)assert.ok(entryKeys.includes(key),"Missing colored title for "+key);
 assert.equal(new Set(entryKeys).size,entryKeys.length);
 const expected=[
  ['mvp_problemon','Flag','--red-text'],['problemon','Flag','--red-text'],
  ['mvp_problems','Search','--red-text'],['opportunities','Search','--red-text'],
  ['mvp_main_hypothesis','Lightbulb','--hypothesis-accent'],
  ['mvp_hypotheses','Lightbulb','--hypothesis-accent'],['ideas','Lightbulb','--hypothesis-accent'],
  ['mvp_experiments','FlaskConical','--experiment-accent'],['experiments','FlaskConical','--experiment-accent'],
  ['mvp_research','Microscope','#75c1ff'],['goals','Target','--objective-accent'],
  ['input_metrics','BarChart3','--blue-text'],
 ];
 for(const [section,icon,color] of expected){
  const line=block.split("\n").find(x=>x.trim().startsWith(section+':'));
  assert.ok(line,"Missing section "+section);
  assert.ok(line.includes("icon:"+icon),"Incorrect icon for "+section);
  assert.ok(line.includes(color),"Incorrect color for "+section);
 }
 assert.match(page,/mvp_experiments: "Experimentos", mvp_research: "Investigación"/);
 assert.doesNotMatch(page,/Experimentos · MVPs/);
 assert.match(page,/const CurrentSectionIcon=sectionHeadings\[view\]\.icon/);
 assert.match(page,/className="minimal-section-title" style=\{\{color:sectionHeadings\[view\]\.color\}\}/);
 assert.match(css,/\.page-heading \.minimal-section-title>svg/);
 assert.match(ai,/className="ai-section-title"><AIBrainIcon/);
 assert.match(css,/\.ai-intro-header \.ai-section-title\{.*color:var\(--lime\)/);
});

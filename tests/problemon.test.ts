import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type {Item,Kind} from "../lib/model";
import {isProblemon,getProblemon,getProblemonCandidates} from "../lib/problemon";
import {getGoiHierarchy} from "../lib/goi-hierarchy";
import {getMvpHierarchy} from "../lib/mvp-hierarchy";
import {sectionPaths,viewForPath} from "../lib/section-routes";

const item=(id:string,kind:Kind,projectId:string,parent:string|null=null,fields:Item["fields"]={}):Item=>({
 id,kind,project_id:projectId,parent_id:parent,workspace_id:"w",related_id:null,
 title:id,fields,owner_id:null,created_at:"2026-10-22",updated_at:"2026-10-22",
 created_by:null,updated_by:null,
});
test("Problema principal is one existing opportunity shared by both trees without any physical copy",()=>{
 const main=item("main","opportunity","greenhunt",null,{is_problemon:true,opportunity_type:"Problema"});
 const ordinary=item("ordinary","opportunity","greenhunt");
 const otherProject=item("cross","opportunity","smartjunk",null,{is_problemon:true});
 const hypothesis=item("hypothesis","hypothesis","greenhunt","main");
 const experiment=item("experiment","experiment","greenhunt","hypothesis",{mvp_hypothesis_id:"hypothesis"});
 const all=[main,ordinary,otherProject,hypothesis,experiment];
 assert.equal(isProblemon(main),true);
 assert.equal(isProblemon(ordinary),false);
 assert.equal(getProblemon(all,"greenhunt"),main);
 assert.equal(getProblemon(all,"smartjunk"),otherProject);
 assert.equal(getProblemon(all,"other"),null);
 assert.deepEqual(getProblemonCandidates(all,"greenhunt"),[ordinary]);
 const growth=getGoiHierarchy(all,"opportunities");
 const mvp=getMvpHierarchy(all,"mvp","greenhunt");
 assert.equal(growth.target.find(x=>x.id==="main"),main);
 assert.equal(mvp.target.find(x=>x.id==="main"),main);
 assert.equal(mvp.roots[0],main);
 assert.deepEqual(mvp.children(main.id).map(x=>x.id),["hypothesis"]);
 assert.deepEqual(mvp.children(hypothesis.id).map(x=>x.id),["experiment"]);
 assert.ok(!growth.orphanOpportunities.includes(main));
 assert.ok(growth.roots.includes(main));
 assert.ok(growth.orphanOpportunities.includes(ordinary));
});
test("Problema principal has separate Growth and MVP section routes and shared CRUD UI",async()=>{
 assert.equal(sectionPaths.problemon,"/goi-tree/problemon");
 assert.equal(sectionPaths.mvp_problemon,"/experimentacion-mvps/problemon");
 assert.equal(viewForPath(sectionPaths.problemon),"problemon");
 assert.equal(viewForPath(sectionPaths.mvp_problemon),"mvp_problemon");
 const [page,component,overview]=await Promise.all([
  readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/problemon-section.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/mvp-experimentation.tsx",import.meta.url),"utf8"),
 ]);
 assert.match(page,/navigateView\("problemon"\)/);
 assert.match(page,/onCreate=\{createProblemon\}/);
 assert.match(page,/is_problemon: true/);
 assert.match(page,/\["problemon","mvp_problemon"\]/);
 assert.match(overview,/problemonSection/);
 assert.match(component,/Designar como problema principal/);
 assert.match(component,/getMvpHierarchy/);
 assert.match(component,/readOnly/);
});
test("DB index enforces one marked opportunity per project without rewriting records",async()=>{
 const migration=await readFile(new URL("../supabase/migrations/20261022203000_one_problemon_per_project.sql",import.meta.url),"utf8");
 assert.match(migration,/unique index if not exists one_problemon_per_project/);
 assert.match(migration,/kind='opportunity'/);
 assert.match(migration,/fields->>'is_problemon'/);
 assert.doesNotMatch(migration,/delete from|update public\.records|drop table|drop policy/i);
});

test("Principal problem section starts with all children folded and displays ICE on revealed records",async()=>{
 const component=await readFile(new URL("../app/problemon-section.tsx",import.meta.url),"utf8");
 assert.match(component,/<details className="goi-hierarchy-toggle problemon-children-toggle">/);
 assert.doesNotMatch(component,/<details open className="goi-hierarchy-toggle problemon-children-toggle">/);
 assert.match(component,/score\(item\.fields\)/);
 assert.match(component,/Problema principal/);
 assert.match(component,/Mostrar hijos/);
});

test("Problemas u oportunidades only lists ordinary records, never the principal problem",()=>{
 const principal=item("principal","opportunity","p",null,{is_problemon:true,opportunity_type:"Problema"});
 const problem=item("problem","opportunity","p",null,{opportunity_type:"Problema"});
 const opportunity=item("opportunity","opportunity","p",null,{opportunity_type:"Oportunidad"});
 const hypothesis=item("hypothesis","hypothesis","p","principal");
 const experiment=item("experiment","experiment","p","hypothesis",{mvp_hypothesis_id:"hypothesis"});
 const anotherProject=item("foreign","opportunity","q");
 const rows=[principal,problem,opportunity,hypothesis,experiment,anotherProject];
 const ordinary=getMvpHierarchy(rows,"mvp_problems","p");
 assert.deepEqual(ordinary.target.map(r=>r.id),["problem","opportunity"]);
 assert.deepEqual(ordinary.roots.map(r=>r.id),["opportunity","problem"]);
 assert.ok(!ordinary.roots.some(isProblemon));
 assert.ok(!ordinary.target.some(isProblemon));
 // The original record and its descendants remain accessible in the other views.
 const overview=getMvpHierarchy(rows,"mvp","p");
 assert.ok(overview.roots.includes(principal));
 const hypotheses=getMvpHierarchy(rows,"mvp_hypotheses","p");
 assert.ok(hypotheses.roots.includes(principal));
 assert.deepEqual(hypotheses.children("principal").map(r=>r.id),["hypothesis"]);
 assert.deepEqual(hypotheses.children("hypothesis").map(r=>r.id),["experiment"]);
 const onlyPrincipal=getMvpHierarchy([principal,hypothesis,experiment],"mvp_problems","p");
 assert.deepEqual(onlyPrincipal.target,[]);
 assert.deepEqual(onlyPrincipal.roots,[]);
});

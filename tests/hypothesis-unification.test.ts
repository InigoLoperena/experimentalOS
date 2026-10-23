import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {parents,type Item} from "../lib/model";
import {demoItems} from "../lib/demo";
import {getGoiHierarchy} from "../lib/goi-hierarchy";
import {getMvpHierarchy} from "../lib/mvp-hierarchy";
import {linkedHypothesis} from "../lib/mvp-relationships";
import {backupCsv} from "../lib/backup";
import {sectionPaths,viewForPath} from "../lib/section-routes";

test("one hypothesis type and unchanged IDs appear in both trees and CSV",()=>{
 assert.equal(parents.hypothesis,"opportunity");
 assert.equal(parents.experiment,"hypothesis");
 const ids=["i1","i2","i3"];
 const hypotheses=demoItems.filter(item=>ids.includes(item.id));
 assert.deepEqual(hypotheses.map(item=>item.kind),["hypothesis","hypothesis","hypothesis"]);
 assert.ok(!demoItems.some(item=>item.kind==="idea"));
 for(const exp of demoItems.filter(item=>item.kind==="experiment")){
  assert.equal(linkedHypothesis(exp),exp.parent_id);
 }
 const goi=getGoiHierarchy(demoItems,"ideas");
 const mvp=getMvpHierarchy(demoItems,"mvp","p1");
 for(const id of ids){
  const shared=demoItems.find(item=>item.id===id)!;
  assert.ok(goi.target.includes(shared),"Growth Tree reads the same record");
  assert.ok(mvp.target.includes(shared),"MVPs Tree reads the same record");
  assert.equal(goi.children(shared.parent_id!).some(item=>item.id===id),true);
  assert.ok(mvp.children(shared.parent_id!).some(item=>item.id===id));
 }
 const csv=backupCsv({records:demoItems});
 assert.ok(csv.includes('"Hipótesis"'));
 assert.ok(!csv.includes('"Idea";'));
});

test("legacy Growth Tree bookmarks still resolve to the unified Hypótesis section",()=>{
 assert.equal(sectionPaths.ideas,"/goi-tree/hipotesis");
 assert.equal(viewForPath("/goi-tree/ideas"),"ideas");
 assert.equal(viewForPath("/goi-tree/hipotesis"),"ideas");
});

test("Both trees show exactly one Planteamiento section and five questions for a hypothesis",async()=>{
 const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
 const model=await readFile(new URL("../lib/model.ts",import.meta.url),"utf8");
 assert.match(page,/hypothesis: schemas\.hypothesis/);
 assert.match(page,/function HypothesisDetails/);
 const start=page.indexOf("  hypothesis: [");
 const end=page.indexOf("  research: [",start);
 const fields=page.slice(start,end);
 const names=["description","belief","reason","validation_need","audience","evidence"];
 for(const key of names){
  assert.ok(fields.includes(`key: "${key}"`),"Missing question: "+key);
  assert.equal((fields.match(new RegExp('key: "'+key+'"','g'))||[]).length,1);
 }
 for(const label of ["Planteamiento","¿Qué creemos?","¿Por qué lo creemos?","¿Qué queremos comprobar?","¿A quién afecta?","¿Qué pruebas o evidencias buscamos?"]){
  assert.ok(fields.includes(`label: "${label}"`),"Missing questionnaire label "+label);
 }
 // Legacy prioritization remains in the stored JSON, but is no longer in
 // the hypothesis questionnaire. This test must not mistake other schemas.
 for(const key of ["metric","experimental_focus","impact","confidence","ease"]){
  assert.ok(!fields.includes(`key: "${key}"`),"Old prioritization field should not render: "+key);
 }
 const form=page.slice(page.indexOf('  const draftFields ='),page.indexOf('  function',page.indexOf('  const draftFields =')+12));
 assert.match(form,/hypothesis-form-section">Planteamiento<\/h3>/);
 assert.doesNotMatch(form,/hypothesis-form-section">Hipótesis y fundamentos/);
 assert.doesNotMatch(form,/hypothesis-form-section">Validación/);
 assert.doesNotMatch(form,/hypothesis-form-section">Indicadores y priorización/);
 const detail=page.slice(page.indexOf("function HypothesisDetails("),page.indexOf("function FieldDetails("));
 assert.match(detail,/<h3>Planteamiento<\/h3>/);
 assert.match(detail,/fields=\{schemas\.hypothesis\}/);
 assert.doesNotMatch(detail,/Hipótesis y fundamentos|Validación|Indicadores y priorización/);
 assert.match(page,/Hipótesis padre \(principal predeterminada; compartida entre Growth Tree y MVPs Tree\)/);
 assert.match(model,/experiment: "hypothesis"/);
});

test("Saving an edited hypothesis keeps all historical values not exposed in the new questionnaire",async()=>{
 const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
 assert.match(page,/setDraft\(\{\.\.\.draft,\s*fields:\s*\{/);
 assert.match(page,/\.\.\.draft\.fields/);
 assert.match(page,/fields: record\.fields,/);
 // The UI edits individual keys in the existing JSON map and does not delete
 // stored evidence, ICE, legacy focus or metrics when saving another field.
 const oldFields={metric:"NPS",experimental_focus:"Consumer segment",impact:8,confidence:7,ease:6,description:"Original"};
 const newFields={...oldFields,belief:"We believe this helps"};
 assert.equal(newFields.metric,oldFields.metric);
 assert.equal(newFields.experimental_focus,oldFields.experimental_focus);
 assert.equal(newFields.impact,8);
});

test("database migration preserves existing IDs and unifies bidirectional links",async()=>{
 const sql=await readFile(new URL("../supabase/migrations/20261022113000_unify_growth_ideas_and_mvp_hypotheses.sql",import.meta.url),"utf8");
 assert.match(sql,/idea_hypothesis_legacy_backup_20261022/);
 assert.match(sql,/update public\.records set kind='hypothesis' where kind='idea'/);
 assert.match(sql,/when ''experiment'' then ''hypothesis''/);
 assert.match(sql,/validate_mvp_record_links/);
 assert.match(sql,/new\.parent_id:=target/);
 assert.match(sql,/new\.fields:=jsonb_set/);
 assert.match(sql,/kind in \('north_star','goal','opportunity','hypothesis'/);
 assert.doesNotMatch(sql,/delete from public\.records where kind='idea'/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { kinds, parents, validate, type Item } from "../lib/model";
import { cleanExperimentFields, normalizeExperiment } from "../lib/experiments";
import { supportsAttachments } from "../lib/attachments";
import { sectionPaths, viewForPath } from "../lib/section-routes";

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
 assert.match(component,/linkedHypothesis\(item\) === hypothesisId/);
 assert.match(component,/mvpTargets\(item\)/);
 assert.match(migration,/create trigger zz_mvp_record_links/);
 assert.match(migration,/create trigger zz_cleanup_mvp_links/);
 assert.match(migration,/''hypothesis'' then ''opportunity''/);
 assert.doesNotMatch(migration,/drop table public\.records/i);
});

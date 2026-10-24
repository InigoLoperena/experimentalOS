import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=(relative:string)=>readFile(new URL("../"+relative,import.meta.url),"utf8");

test("Creating hypothesis/experiment/research/problem/goal must never inherit parent text",async()=>{
 const page=await source("app/workspace-app.tsx");
 assert.doesNotMatch(page,/const contextFields\s*:/);
 assert.doesNotMatch(page,/\.\.\.contextFields/);
 assert.doesNotMatch(page,/metric:\s*goal\?\.fields\.metric/);
 assert.doesNotMatch(page,/evidence:\s*parent\?\.fields\.evidence/);
 assert.doesNotMatch(page,/context:\s*parent\?\.fields\.description/);
 assert.doesNotMatch(page,/tags:\s*parent\?\.fields\.tags/);
 assert.match(page,/title:\s*""/);
 assert.match(page,/Los textos nuevos quedan vacíos/);
});

test("Unknown project descriptions cannot silently become invented marketing copy",async()=>{
 const page=await source("app/workspace-app.tsx");
 assert.doesNotMatch(page,/defaultProjectDescriptions/);
 assert.doesNotMatch(page,/Descripción pendiente de completar\./);
 assert.match(page,/return String\(project\.fields\.description \|\| ""\)\.trim\(\)/);
});

test("AI content is only transferred into a record by an explicit UI action",async()=>{
 const page=await source("app/workspace-app.tsx");
 const assistant=await source("app/experiment-assistant.tsx");
 const strategic=await source("app/strategic-ai.tsx");
 // Proposals are presented before any field is applied; they are not saved
 // automatically by API response processing.
 assert.match(assistant,/onClick=\{\(\) => \{ onApply\(/);
 assert.match(assistant,/Rellenar formulario para revisar/);
 assert.match(strategic,/onClick=\{\(\)=>\{if\(entry\.project_id===project\?\.id\)onProposal\(entry\.proposal!\);\}\}/);
 assert.match(strategic,/Revisar y crear experimento/);
 assert.match(page,/function openAIProposal\(proposal:Preparation\)/);
 assert.match(page,/applyPreparation\(\{\},proposal\)/);
 assert.match(page,/onProposal=\{openAIProposal\}/);
});

test("Demonstration records stay local and do not auto-populate real workspaces",async()=>{
 const page=await source("app/workspace-app.tsx");
 assert.match(page,/if \(demo\) \{/);
 assert.match(page,/setItems\(structuredClone\(demoItems\)\.map\(normalizeExperiment\)\)/);
});

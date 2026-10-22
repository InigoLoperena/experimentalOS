import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("GOI Tree sidebar uses one blue selected state for every subsection",async()=>{
 const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
 assert.match(css,/\.nav-goi-subsection\.active,[\s\S]*?\.nav-goi-subsection:hover\s*\{\s*background: var\(--input-metric-soft\);[\s\S]*?border-color: rgba\(130, 198, 255,/);
 assert.doesNotMatch(css,/\.nav-goi-subsection\.objective\.active/);
 assert.doesNotMatch(css,/\.nav-goi-subsection\.input-metric\.active/);
 for(const label of ["objective","input-metric","opportunity","hypothesis"])assert.ok(css.includes(".nav-goi-subsection."+label));
});

test("Hypothesis parent opportunity has red magnifying-glass label in cards and expanded details",async()=>{
 const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
 const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
 assert.match(page,/const parentOpportunity = parent\.kind === "opportunity"/);
 assert.match(page,/parentOpportunity \? "opportunity"/);
 assert.match(page,/parentOpportunity \? \(\s*isProblemon\(parent\) \? <Flag size=\{17\} color="var\(--red-text\)"/);
 const uses=(page.match(/\{parentTag\(/g)||[]).length;
 assert.ok(uses>=3, "parent label should be shared in cards, experiments and detail view");
 assert.match(css,/\.record-parent-pill\.opportunity\s*\{[^}]*color: var\(--red-text\)/);
 assert.match(css,/\.record-parent-pill\.opportunity > svg\s*\{[^}]*color: inherit/);
});

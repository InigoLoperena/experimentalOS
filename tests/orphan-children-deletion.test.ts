import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validate} from "../lib/model";
import {item} from "./service-fixture";

test("Orphaned opportunities and ideas remain valid, editable and reassignable",()=>{
 for(const kind of ["opportunity","idea","experiment","learning","kr"] as const){
  assert.equal(validate(item(kind,kind)),null,kind+" should remain editable without a parent");
 }
 assert.match(validate({...item("empty","idea"),title:"  "})||"",/Escribe un nombre/);
});

test("Database migration detaches parents without deleting children or weakening RLS",async()=>{
 const sql=await readFile(new URL("../supabase/migrations/20261017183000_orphaned_goi_children.sql",import.meta.url),"utf8");
 assert.match(sql,/on delete set null \(parent_id\)/i);
 assert.match(sql,/on delete set null \(related_id\)/i);
 assert.match(sql,/if new\.parent_id is null and new\.kind in/);
 assert.doesNotMatch(sql,/on delete cascade\s*\(parent_id\)/i);
 assert.doesNotMatch(sql,/disable row level security/i);
});

test("Delete warning preserves descendants and orphan records remain visible in GOI tree",async()=>{
 const page=await readFile(new URL("../app/workspace-app.tsx",import.meta.url),"utf8");
 assert.match(page,/childrenToPreserve = workspaceItems\.filter\(item => item\.parent_id === record\.id\)/);
 assert.match(page,/Elementos sin padre/);
 assert.match(page,/Sin padre \(puedes asignarlo más adelante\)/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { attachmentFileType, attachmentLink } from "../lib/attachments";

test("attachment inputs reject unsafe links, unsupported files and oversized uploads", () => {
  assert.equal(attachmentLink(" https://example.org/a?q=1#section "), "https://example.org/a?q=1#section");
  for (const link of ["javascript:alert(1)", "data:text/html,hi", "https://user:password@example.org", "invalid"])
    assert.throws(() => attachmentLink(link));
  assert.equal(attachmentFileType({ name: "Documento.DOCX", size: 200, type: "" }).kind, "docx");
  assert.equal(attachmentFileType({ name: "captura.png", size: 200, type: "image/png" }).kind, "image");
  for (const file of [{ name: "evil.svg", size: 200, type: "image/svg+xml" }, { name: "evil.png", size: 200, type: "text/html" },
    { name: "big.pdf", size: 10485761, type: "application/pdf" }, { name: "empty.pdf", size: 0, type: "application/pdf" }])
    assert.throws(() => attachmentFileType(file));
});

test("private attachments enforce company isolation, reader restrictions, attribution and cleanup after company deletion", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create role anon;create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
      alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
    for (const file of ["001_initial.sql", "002_project_growth_tree.sql", "003_profiles_and_company.sql", "004_record_attachments.sql"])
      await db.exec((await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8")).replace("create extension if not exists pgcrypto;", ""));
    await db.exec(await readFile(new URL("../supabase/migrations/004_record_attachments.sql", import.meta.url), "utf8"));
    const owner = randomUUID(), viewer = randomUUID(), outsider = randomUUID();
    for (const id of [owner, viewer, outsider]) await db.query(`insert into auth.users values($1,'{"name":"Test"}')`, [id]);
    async function as(id: string) {
      await db.exec("reset role");await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]);await db.exec("set role authenticated");
    }
    async function scalar(sql: string, args: unknown[] = []) { return (await db.query<{ value: string }>(sql, args)).rows[0].value; }
    async function record(w: string, project: string | null, kind: string, parent: string | null = null) {
      return scalar("insert into records(workspace_id,project_id,kind,title,parent_id) values($1,$2,$3,$3,$4) returning id as value", [w, project, kind, parent]);
    }
    async function file(w: string, r: string) {
      const id = randomUUID(), path = `${w}/${r}/${id}.png`;
      await db.query("insert into record_attachments(id,workspace_id,record_id,name,kind,storage_path,mime_type,size,created_by) values($1,$2,$3,'Screenshot','image',$4,'image/png',100,$5)", [id, w, r, path, outsider]);
      await db.query("insert into storage.objects(bucket_id,name) values('record-attachments',$1)", [path]);
      return { id, path };
    }
    await as(owner);
    const w = await scalar("select create_workspace('Empresa A') as value");
    const project = await record(w, null, "project");
    const experiment = await record(w, project, "experiment");
    const learning = await record(w, project, "learning", experiment);
    const ns = await record(w, project, "north_star");
    const goal = await record(w, project, "goal", ns);
    const opportunity = await record(w, project, "opportunity", goal);
    const idea = await record(w, project, "idea", opportunity);
    for (const r of [experiment, learning, ns, goal, opportunity, idea])
      await db.query("insert into record_attachments(workspace_id,record_id,name,kind,url) values($1,$2,'Evidence','link','https://example.org')", [w, r]);
    const uploaded = await file(w, experiment);
    const doomed = await file(w, learning);
    assert.equal(await scalar("select created_by as value from record_attachments where id=$1", [uploaded.id]), owner);
    assert.equal(await scalar("select actor_id as value from audit_log where action='attach' order by created_at desc limit 1"), owner);
    await assert.rejects(db.query("insert into record_attachments(workspace_id,record_id,name,kind,url) values($1,$2,'Bad','link','javascript:alert(1)')", [w, experiment]));
    await assert.rejects(db.query("insert into record_attachments(workspace_id,record_id,name,kind,url) values($1,$2,'Bad','link',null)", [w, experiment]));
    await assert.rejects(db.query("insert into record_attachments(workspace_id,record_id,name,kind,url) values($1,$2,'Bad','link','https://example.org')", [w, project]));
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('record-attachments','unreserved.png')"));
    const token = await scalar("select create_invitation($1,'viewer') as value", [w]);
    await as(viewer);await db.query("select join_workspace($1)", [token]);
    assert.equal((await db.query("select * from record_attachments")).rows.length, 8);
    assert.equal((await db.query("select * from storage.objects")).rows.length, 2);
    await assert.rejects(db.query("insert into record_attachments(workspace_id,record_id,name,kind,url) values($1,$2,'Bad','link','https://example.org')", [w, experiment]));
    assert.equal((await db.query("delete from record_attachments where id=$1 returning id", [uploaded.id])).rows.length, 0);
    assert.equal((await db.query("delete from storage.objects where name=$1 returning id", [uploaded.path])).rows.length, 0);
    await assert.rejects(db.query("insert into attachment_deletions(storage_path,deleted_by) values($1,$2)", [uploaded.path, viewer]));
    await as(outsider);
    const other = await scalar("select create_workspace('Empresa B') as value");
    const otherProject = await record(other, null, "project");
    const otherExperiment = await record(other, otherProject, "experiment");
    const otherFile = await file(other, otherExperiment);
    assert.equal((await db.query("select * from record_attachments where workspace_id=$1", [w])).rows.length, 0);
    assert.equal((await db.query("select * from storage.objects where name=$1", [uploaded.path])).rows.length, 0);
    await assert.rejects(db.query("insert into record_attachments(workspace_id,record_id,name,kind,url) values($1,$2,'Bad','link','https://example.org')", [other, experiment]));
    await as(owner);
    await db.query("delete from records where id=$1", [learning]);
    assert.equal(await scalar("select deleted_by as value from attachment_deletions where storage_path=$1", [doomed.path]), owner);
    await as(viewer);
    assert.equal((await db.query("select * from storage.objects where name=$1", [doomed.path])).rows.length, 0);
    await as(owner);
    assert.equal((await db.query("delete from storage.objects where name=$1 returning id", [doomed.path])).rows.length, 1);
    await db.query("delete from attachment_deletions where storage_path=$1", [doomed.path]);
    await db.query("select delete_workspace($1,'Empresa A')", [w]);
    assert.equal((await db.query("select * from record_attachments")).rows.length, 0);
    assert.equal((await db.query("delete from storage.objects where name=$1 returning id", [uploaded.path])).rows.length, 1);
    await db.query("delete from attachment_deletions where storage_path=$1", [uploaded.path]);
    assert.equal((await db.query("select * from attachment_deletions")).rows.length, 0);
    await as(outsider);
    assert.equal((await db.query("select * from storage.objects where name=$1", [otherFile.path])).rows.length, 1);
    await db.exec("reset role;set role anon");
    await assert.rejects(db.query("select * from record_attachments"));
  } finally { await db.close(); }
});

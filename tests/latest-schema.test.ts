import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("complete migration chain preserves the internal team, invitation-only access, private attachments and GOI comments", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
      create role anon;create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
      alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;`);
    const owner = randomUUID(), editor = randomUUID(), viewer = randomUUID(), outsider = randomUUID();
    const dir = new URL("../supabase/migrations/", import.meta.url);
    const files = (await readdir(dir)).filter(f => f.endsWith(".sql")).sort();
    const migrate = async (file: string) => db.exec((await readFile(new URL(file, dir), "utf8")).replace("create extension if not exists pgcrypto;", ""));
    for (const file of files.filter(f => f < "005")) await migrate(file);
    for (const id of [owner, editor, viewer, outsider]) await db.query("insert into auth.users values($1,'{\"name\":\"Test\"}')", [id]);
    async function as(id: string | null) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
      await db.exec(id ? "set role authenticated" : "set role anon");
    }
    async function scalar<T = string>(sql: string, args: unknown[] = []) { return (await db.query<{ value: T }>(sql, args)).rows[0].value; }
    await as(owner);
    const w = await scalar("select create_workspace('Equipo original') as value");
    const p = await scalar("insert into records(workspace_id,kind,title,fields) values($1,'project','Proyecto','{\"north_star\":\"Compras\"}') returning id as value", [w]);
    await db.exec("reset role");
    for (const file of files.filter(f => f >= "005")) await migrate(file);
    await as(owner);
    assert.equal(await scalar("select open_team_space() as value"), w);
    assert.equal(await scalar("select title as value from records where id=$1", [p]), "Proyecto");
    await assert.rejects(db.query("select create_team('Otra empresa')"));
    const editorToken = await scalar("select create_invitation($1,'editor') as value", [w]);
    const viewerToken = await scalar("select create_invitation($1,'viewer') as value", [w]);
    await as(outsider);
    assert.equal(await scalar("select open_team_space() as value"), null);
    assert.equal((await db.query("select * from records")).rows.length, 0);
    await assert.rejects(db.query("select create_team('Otro equipo')"));
    await as(null);
    const preview = await scalar<Record<string, unknown>>("select get_invitation_preview($1) as value", [editorToken]);
    assert.deepEqual(Object.keys(preview).sort(), ["expires_at", "role", "team_name"]);
    assert.equal(preview.team_name, "Equipo original");
    await as(editor);
    assert.equal(await scalar("select join_workspace($1) as value", [editorToken]), w);
    await assert.rejects(db.query("select join_workspace($1)", [editorToken]));
    async function record(kind: string, parent: string | null = null, fields = {}) {
      return scalar("insert into records(workspace_id,project_id,kind,title,parent_id,fields) values($1,$2,$3,$3,$4,$5) returning id as value", [w, p, kind, parent, JSON.stringify(fields)]);
    }
    await assert.rejects(record("goal"));
    const ns = await record("north_star");
    const goal = await record("goal", ns);
    const subgoal = await record("goal", goal);
    await assert.rejects(db.query("update records set parent_id=$1 where id=$2", [subgoal, goal]));
    const opportunity = await record("opportunity", goal);
    const idea = await record("idea", opportunity);
    const experiment = await record("experiment", idea, { posthog_experiment_id: "101", hypothesis: "Prueba", status: "obsolete", impact: 5 });
    const fields = await scalar<Record<string, unknown>>("select fields as value from records where id=$1", [experiment]);
    assert.equal(fields.posthog_experiment_id, "101");assert.equal(fields.status, undefined);
    const learning = await record("learning", experiment);
    const comment = await scalar("insert into record_comments(workspace_id,record_id,author_id,author_name,body) values($1,$2,$3,'Forged','Evidencia') returning id as value", [w, goal, outsider]);
    assert.equal(await scalar("select author_id as value from record_comments where id=$1", [comment]), editor);
    await assert.rejects(db.query("insert into record_comments(workspace_id,record_id,author_id,author_name,body) values($1,$2,$3,'Test',' ')", [w, goal, editor]));
    const attachmentId = randomUUID(), path = `${w}/${learning}/${attachmentId}.png`;
    await db.query("insert into record_attachments(id,workspace_id,record_id,name,kind,storage_path,mime_type,size) values($1,$2,$3,'Private','image',$4,'image/png',100)", [attachmentId, w, learning, path]);
    await db.query("insert into storage.objects(bucket_id,name) values('record-attachments',$1)", [path]);
    await as(null);
    const publicData = await scalar<{ attachments: unknown[]; records: { id: string }[] }>("select get_public_preview() as value");
    assert.equal(publicData.attachments.length, 0);
    assert.ok(publicData.records.some(r => r.id === p));
    assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
    await assert.rejects(db.query("select * from record_comments"));
    await as(viewer);
    await db.query("select join_workspace($1)", [viewerToken]);
    assert.equal((await db.query("select * from record_comments")).rows.length, 1);
    assert.equal((await db.query("select * from storage.objects")).rows.length, 1);
    await assert.rejects(db.query("insert into record_comments(workspace_id,record_id,author_id,author_name,body) values($1,$2,$3,'Test','No')", [w, goal, viewer]));
    assert.equal((await db.query("delete from record_attachments where id=$1 returning id", [attachmentId])).rows.length, 0);
    assert.equal((await db.query("delete from records where id=$1 returning id", [experiment])).rows.length, 0);
    await as(outsider);
    assert.equal((await db.query("select * from record_comments")).rows.length, 0);
    assert.equal((await db.query("select * from record_attachments")).rows.length, 0);
    await as(owner);
    await db.query("delete from records where workspace_id=$1 and project_id=$2", [w, p]);
    await db.query("delete from records where id=$1", [p]);
    assert.equal((await db.query("select * from record_comments")).rows.length, 0);
    assert.equal((await db.query("select * from record_attachments")).rows.length, 0);
    assert.equal(await scalar("select storage_path as value from attachment_deletions"), path);
    await db.query("select remove_member($1,$2)", [w, editor]);
    await as(editor);
    assert.equal(await scalar("select open_team_space() as value"), null);
    assert.equal((await db.query("select * from workspaces")).rows.length, 0);
  } finally { await db.close(); }
});

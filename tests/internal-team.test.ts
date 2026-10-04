import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

async function database() {
  const db = new PGlite();
  await db.exec(`create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create role anon;create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for (const file of ["001_initial.sql", "002_project_growth_tree.sql", "003_profiles_and_company.sql"])
    await db.exec((await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8")).replace("create extension if not exists pgcrypto;", ""));
  return db;
}
const owner = "11111111-1111-4111-8111-111111111111";
const editor = "22222222-2222-4222-8222-222222222222";
const outsider = "33333333-3333-4333-8333-333333333333";
async function as(db: PGlite, id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function value(db: PGlite, sql: string, params: unknown[] = []) {
  return (await db.query<{ value: string | null }>(sql, params)).rows[0].value;
}
async function migrate(db: PGlite) {
  await db.exec("reset role");
  await db.exec(await readFile(new URL("../supabase/migrations/005_internal_team.sql", import.meta.url), "utf8"));
}

test("internal team preserves data, retires company operations and requires invitations without restoring removed access", async () => {
  const db = await database();
  try {
    for (const id of [owner, editor, outsider]) await db.query("insert into auth.users values($1,'{}')", [id]);
    await as(db, owner);
    const space = await value(db, "select create_workspace('Equipo existente') as value");
    const project = await value(db, "insert into records(workspace_id,kind,title) values($1,'project','Proyecto existente') returning id as value", [space]);
    const token = await value(db, "select create_invitation($1,'editor') as value", [space]);
    await as(db, outsider);
    const other = await value(db, "select create_workspace('Legado') as value");
    const wrongToken = await value(db, "select create_invitation($1,'editor') as value", [other]);
    // Explicit dates avoid a tie when both fixtures are created within a millisecond.
    await db.exec("reset role");
    await db.query("update workspaces set created_at='2020-01-01' where id=$1", [space]);
    await migrate(db);
    await as(db, owner);
    assert.equal(await value(db, "select open_internal_space() as value"), space);
    assert.equal(await value(db, "select title as value from records where id=$1", [project]), "Proyecto existente");
    await assert.rejects(db.query("select create_workspace('Nueva empresa')"));
    await assert.rejects(db.query("select update_workspace_profile($1,'Cambio',null,null)", [space]));
    await assert.rejects(db.query("select delete_workspace($1,'Equipo existente')", [space]));
    await assert.rejects(db.query("select * from internal_team"));
    await as(db, editor);
    assert.equal(await value(db, "select open_internal_space() as value"), null);
    assert.equal((await db.query("select * from records")).rows.length, 0);
    await assert.rejects(db.query("select join_workspace($1)", [wrongToken]));
    assert.equal(await value(db, "select join_workspace($1) as value", [token]), space);
    assert.equal(await value(db, "select open_internal_space() as value"), space);
    await assert.rejects(db.query("select join_workspace($1)", [token]));
    await db.query("select update_my_profile('Ana',null)");
    await assert.rejects(db.query("select remove_member($1,$2)", [space, owner]));
    await as(db, owner);
    await db.query("select change_member_role($1,$2,'viewer')", [space, editor]);
    await as(db, editor);
    await assert.rejects(db.query("insert into records(workspace_id,kind,title) values($1,'project','No permitido')", [space]));
    await as(db, owner);
    await db.query("select remove_member($1,$2)", [space, editor]);
    await as(db, editor);
    assert.equal(await value(db, "select open_internal_space() as value"), null);
    assert.equal((await db.query("select * from records")).rows.length, 0);
    assert.equal(await value(db, "select name as value from profiles where id=$1", [editor]), "Ana");
    await migrate(db);
    await as(db, owner);
    assert.equal(await value(db, "select open_internal_space() as value"), space);
    await db.exec("reset role");
    assert.equal((await db.query("select * from workspaces")).rows.length, 2);
    assert.equal((await db.query("select * from profiles")).rows.length, 3);
    await db.exec("set role anon");
    await assert.rejects(db.query("select open_internal_space()"));
  } finally { await db.close(); }
});

test("a fresh installation creates one internal team once and makes only the first user administrator", async () => {
  const db = await database();
  try {
    for (const id of [owner, editor]) await db.query("insert into auth.users values($1,'{}')", [id]);
    await migrate(db);
    await as(db, owner);
    const space = await value(db, "select open_internal_space() as value");
    assert.ok(space);
    assert.equal(await value(db, "select member_role($1) as value", [space]), "owner");
    assert.equal(await value(db, "select open_internal_space() as value"), space);
    await as(db, editor);
    assert.equal(await value(db, "select open_internal_space() as value"), null);
    await db.exec("reset role");
    assert.equal((await db.query("select * from workspaces")).rows.length, 1);
    assert.equal((await db.query("select * from members")).rows.length, 1);
  } finally { await db.close(); }
});

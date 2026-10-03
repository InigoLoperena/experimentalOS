import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("profiles are personal; only company administrators can edit, remove members or delete their company", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create role anon;create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
    for (const file of ["001_initial.sql", "002_project_growth_tree.sql", "003_profiles_and_company.sql"])
      await db.exec((await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8")).replace("create extension if not exists pgcrypto;", ""));
    const owner = "11111111-1111-4111-8111-111111111111";
    const editor = "22222222-2222-4222-8222-222222222222";
    const outsider = "33333333-3333-4333-8333-333333333333";
    for (const id of [owner, editor, outsider]) await db.query(`insert into auth.users values($1,'{"name":"Original"}')`, [id]);
    async function as(id: string) {
      await db.exec("reset role");
      await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]);
      await db.exec("set role authenticated");
    }
    async function scalar(sql: string, params: unknown[] = []) {
      return (await db.query<{ value: string }>(sql, params)).rows[0].value;
    }
    const photo = "data:image/png;base64,aGVsbG8=";
    await as(owner);
    const company = await scalar(`select create_workspace('Empresa A') as value`);
    await db.query("select update_my_profile('  Iñigo  ',$1)", [photo]);
    assert.equal(await scalar("select name as value from profiles where id=$1", [owner]), "Iñigo");
    assert.equal(await scalar("select avatar_url as value from profiles where id=$1", [owner]), photo);
    await assert.rejects(db.query("select update_my_profile('   ',null)"));
    await assert.rejects(db.query("select update_my_profile('Name','javascript:alert(1)')"));
    await assert.rejects(db.query("select update_my_profile('Name','data:image/svg+xml;base64,aGVsbG8=')"));
    await assert.rejects(db.query("select update_my_profile('Name',$1)", ["data:image/png;base64," + "A".repeat(400000)]));
    await assert.rejects(db.query("update profiles set name='Forged' where id=$1", [editor]));
    await db.query("select update_workspace_profile($1,'Empresa editada','https://example.org',$2)", [company, photo]);
    await assert.rejects(db.query("select update_workspace_profile($1,'Empresa editada','javascript:alert(1)',null)", [company]));
    const token = await scalar("select create_invitation($1,'editor') as value", [company]);
    await as(editor);
    await db.query("select join_workspace($1)", [token]);
    await db.query("select update_my_profile('Ana',null)");
    await assert.rejects(db.query("select update_workspace_profile($1,'Wrong',null,null)", [company]));
    await assert.rejects(db.query("select delete_workspace($1,'Empresa editada')", [company]));
    await assert.rejects(db.query("select remove_member($1,$2)", [company, owner]));
    const project = await scalar("insert into records(workspace_id,kind,title) values($1,'project','P') returning id as value", [company]);
    const northStar = await scalar("insert into records(workspace_id,project_id,kind,title) values($1,$2,'north_star','NS') returning id as value", [company, project]);
    const goal = await scalar("insert into records(workspace_id,project_id,kind,title,parent_id) values($1,$2,'goal','Goal',$3) returning id as value", [company, project, northStar]);
    const experiment = await scalar("insert into records(workspace_id,project_id,kind,title,owner_id) values($1,$2,'experiment','Experiment',$3) returning id as value", [company, project, editor]);
    await db.query("insert into records(workspace_id,project_id,kind,title,parent_id) values($1,$2,'learning','Learning',$3)", [company, project, experiment]);
    assert.ok(goal);
    await as(outsider);
    const otherCompany = await scalar("select create_workspace('Empresa B') as value");
    const otherProject = await scalar("insert into records(workspace_id,kind,title) values($1,'project','Other project') returning id as value", [otherCompany]);
    await db.query("insert into records(workspace_id,project_id,kind,title,owner_id) values($1,$2,'experiment','Other experiment',$3)", [otherCompany, otherProject, outsider]);
    await assert.rejects(db.query("select update_workspace_profile($1,'Wrong',null,null)", [company]));
    await assert.rejects(db.query("select remove_member($1,$2)", [company, editor]));
    await assert.rejects(db.query("select delete_workspace($1,'Empresa editada')", [company]));
    assert.equal((await db.query("select * from profiles where id=$1", [owner])).rows.length, 0);
    await as(owner);
    await assert.rejects(db.query("select remove_member($1,$2)", [company, owner]));
    await assert.rejects(db.query("select remove_member($1,$2)", [otherCompany, outsider]));
    await db.query("select remove_member($1,$2)", [company, editor]);
    assert.equal(await scalar("select owner_id as value from records where id=$1", [experiment]), null);
    assert.equal(await scalar("select created_by_name as value from records where id=$1", [experiment]), "Ana");
    await as(editor);
    assert.equal((await db.query("select * from records where workspace_id=$1", [company])).rows.length, 0);
    assert.equal(await scalar("select name as value from profiles where id=$1", [editor]), "Ana");
    await as(owner);
    await assert.rejects(db.query("select delete_workspace($1,'Wrong confirmation')", [company]));
    assert.ok((await db.query("select * from records where workspace_id=$1", [company])).rows.length > 0);
    // Re-running the migration preserves profile edits and company data.
    await db.exec("reset role");
    await db.exec(await readFile(new URL("../supabase/migrations/003_profiles_and_company.sql", import.meta.url), "utf8"));
    await as(owner);
    assert.equal(await scalar("select name as value from profiles where id=$1", [owner]), "Iñigo");
    await db.query("select delete_workspace($1,'Empresa editada')", [company]);
    await db.exec("reset role");
    for (const table of ["workspaces", "members", "records", "audit_log", "invitations"])
      assert.equal((await db.query(`select * from ${table} where ${table === "workspaces" ? "id" : "workspace_id"}=$1`, [company])).rows.length, 0, `${table} removed with company`);
    assert.equal((await db.query("select * from profiles")).rows.length, 3);
    assert.equal(await scalar("select name as value from workspaces where id=$1", [otherCompany]), "Empresa B");
    assert.equal((await db.query("select * from records where workspace_id=$1", [otherCompany])).rows.length, 2);
    assert.equal((await db.query("select * from members where workspace_id=$1", [otherCompany])).rows.length, 1);
    await db.exec("set role anon");
    await assert.rejects(db.query("select update_my_profile('Anonymous',null)"));
    await assert.rejects(db.query("select delete_workspace($1,'Empresa B')", [otherCompany]));
  } finally { await db.close(); }
});

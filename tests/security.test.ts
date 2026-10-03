import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("Postgres migration: tenant isolation, viewer restrictions, audit attribution and single-use invitations", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create role anon;create role authenticated;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
    );
    const migration = (
      await readFile(
        new URL("../supabase/migrations/001_initial.sql", import.meta.url),
        "utf8",
      )
    ).replace("create extension if not exists pgcrypto;", "");
    await db.exec(migration);
    const owner = "11111111-1111-4111-8111-111111111111",
      outsider = "22222222-2222-4222-8222-222222222222",
      viewer = "33333333-3333-4333-8333-333333333333";
    for (const id of [owner, outsider, viewer])
      await db.query(`insert into auth.users values($1,'{"name":"Test"}')`, [
        id,
      ]);
    async function as(id: string) {
      await db.exec("reset role");
      await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
        id,
      ]);
      await db.exec("set role authenticated");
    }
    await as(owner);
    const w = (
      await db.query<{ id: string }>(
        `select public.create_workspace('Company A') as id`,
      )
    ).rows[0].id;
    const nsm = (
      await db.query<{ id: string }>(
        `insert into public.records(workspace_id,kind,title,created_by) values($1,'north_star','Value delivered',$2) returning id`,
        [w, outsider],
      )
    ).rows[0].id;
    const a = (
      await db.query<{ actor_id: string }>(
        `select actor_id from public.audit_log where record_id=$1`,
        [nsm],
      )
    ).rows[0];
    assert.equal(a.actor_id, owner);
    assert.equal(
      (
        await db.query<{ created_by: string }>(
          `select created_by from public.records where id=$1`,
          [nsm],
        )
      ).rows[0].created_by,
      owner,
    );
    const token = (
      await db.query<{ token: string }>(
        `select create_invitation($1,'viewer') as token`,
        [w],
      )
    ).rows[0].token;
    await as(outsider);
    assert.equal(
      (await db.query("select * from public.records")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.audit_log")).rows.length,
      0,
    );
    const w2 = (
      await db.query<{ id: string }>(
        `select public.create_workspace('Company B') as id`,
      )
    ).rows[0].id;
    await assert.rejects(
      db.query(
        `insert into public.records(workspace_id,kind,title,parent_id) values($1,'goal','Bad link',$2)`,
        [w2, nsm],
      ),
    );
    await as(viewer);
    await db.query("select join_workspace($1)", [token]);
    assert.equal(
      (await db.query("select * from public.records")).rows.length,
      1,
    );
    await assert.rejects(
      db.query(
        `insert into public.records(workspace_id,kind,title,parent_id) values($1,'goal','Forbidden',$2)`,
        [w, nsm],
      ),
    );
    assert.equal(
      (
        await db.query(
          `update public.records set title='Unauthorized' where id=$1 returning id`,
          [nsm],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        `insert into public.audit_log(workspace_id,title,action) values($1,'Forged','insert')`,
        [w],
      ),
    );
    await assert.rejects(
      db.query(`update public.members set role='owner' where user_id=$1`, [
        viewer,
      ]),
    );
    await assert.rejects(
      db.query(`select create_invitation($1,'editor')`, [w]),
    );
    await as(outsider);
    await assert.rejects(db.query("select join_workspace($1)", [token]));
    await as(owner);
    await db.query(`select change_member_role($1,$2,'editor')`, [w, viewer]);
    await as(viewer);
    const g = (
      await db.query<{ id: string }>(
        `insert into public.records(workspace_id,kind,title,parent_id,owner_id) values($1,'goal','Goal',$2,$3) returning id`,
        [w, nsm, viewer],
      )
    ).rows[0].id;
    const o = (
      await db.query<{ id: string }>(
        `insert into public.records(workspace_id,kind,title,parent_id) values($1,'opportunity','Opportunity',$2) returning id`,
        [w, g],
      )
    ).rows[0].id;
    const idea = (
      await db.query<{ id: string }>(
        `insert into public.records(workspace_id,kind,title,parent_id) values($1,'idea','Idea',$2) returning id`,
        [w, o],
      )
    ).rows[0].id;
    await assert.rejects(
      db.query(
        `insert into public.records(workspace_id,kind,title,parent_id,fields) values($1,'experiment','Not ready',$2,'{"status":"En curso"}')`,
        [w, idea],
      ),
    );
    const fields = {
      status: "En curso",
      hypothesis: "H",
      metric: "M",
      success_criteria: "S",
      method: "A/B aleatorizado",
      start: "2026-10-01",
      end: "2026-10-20",
      baseline: 0,
      target: 1,
      variants: JSON.stringify([
        { name: "A", traffic: 50, exposed: 10, conversions: 1 },
        { name: "B", traffic: 50, exposed: 10, conversions: 2 },
      ]),
    };
    const e = (
      await db.query<{ id: string }>(
        `insert into public.records(workspace_id,kind,title,parent_id,owner_id,fields) values($1,'experiment','Valid',$2,$3,$4) returning id`,
        [w, idea, viewer, JSON.stringify(fields)],
      )
    ).rows[0].id;
    await assert.rejects(
      db.query(
        `update public.records set fields=fields||'{"status":"Finalizado"}' where id=$1`,
        [e],
      ),
    );
    await db.query(
      `update public.records set fields=fields||'{"status":"Finalizado","result":"Evidence","conclusion":"Limited","learning":"Learning","decision":"Iterar"}' where id=$1`,
      [e],
    );
    assert.equal(
      (
        await db.query<{ actor_id: string }>(
          `select actor_id from public.audit_log where record_id=$1 order by created_at desc limit 1`,
          [e],
        )
      ).rows[0].actor_id,
      viewer,
    );
    await as(owner);
    const validToken = (
      await db.query<{ token: string }>(
        `select create_invitation($1,'editor') as token`,
        [w],
      )
    ).rows[0].token;
    await db.exec("reset role");
    await db.query(
      `update public.invitations set expires_at=now()-interval '1 second' where token=$1`,
      [validToken],
    );
    await as(outsider);
    await assert.rejects(db.query("select join_workspace($1)", [validToken]));
    await as(owner);
    await db.query("select remove_member($1,$2)", [w, viewer]);
    await as(viewer);
    assert.equal(
      (await db.query("select * from public.records")).rows.length,
      0,
    );
    await as(owner);
    assert.equal(
      (
        await db.query<{ actor_name: string }>(
          `select actor_name from public.audit_log where record_id=$1 order by created_at desc limit 1`,
          [e],
        )
      ).rows[0].actor_name,
      "Test",
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(db.query("select * from public.records"));
  } finally {
    await db.close();
  }
});

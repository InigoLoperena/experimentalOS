import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("project migration preserves legacy data and enforces independent Growth Trees", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create role anon;create role authenticated;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
    );
    const initial = (
      await readFile(
        new URL("../supabase/migrations/001_initial.sql", import.meta.url),
        "utf8",
      )
    ).replace("create extension if not exists pgcrypto;", "");
    const migration = await readFile(
      new URL(
        "../supabase/migrations/002_project_growth_tree.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(initial);
    const owner = "11111111-1111-4111-8111-111111111111";
    const viewer = "22222222-2222-4222-8222-222222222222";
    const outsider = "33333333-3333-4333-8333-333333333333";
    for (const id of [owner, viewer, outsider])
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
    async function legacy(
      w: string,
      kind: string,
      parent: string | null,
      fields = {},
    ) {
      return (
        await db.query<{ id: string }>(
          `insert into public.records(workspace_id,kind,title,parent_id,owner_id,fields) values($1,$2,$2,$3,$4,$5) returning id`,
          [w, kind, parent, owner, JSON.stringify(fields)],
        )
      ).rows[0].id;
    }
    await as(owner);
    const w = (
      await db.query<{ id: string }>(`select create_workspace('A') as id`)
    ).rows[0].id;
    const p1 = await legacy(w, "project", null);
    const n1 = await legacy(w, "north_star", null);
    const g1 = await legacy(w, "goal", n1);
    const o1 = await legacy(w, "opportunity", g1);
    const i1 = await legacy(w, "idea", o1);
    const e1 = await legacy(w, "experiment", i1, {
      status: "Finalizado",
      hypothesis: "H",
      metric: "M",
      success_criteria: "S",
      method: "Piloto",
      start: "2026-10-01",
      end: "2026-10-03",
      baseline: 0,
      target: 1,
      result: "Evidence",
      conclusion: "Limited",
      learning: "Learning",
      decision: "Iterar",
      project_id: p1,
    });
    const auditBefore = (
      await db.query(`select * from audit_log where record_id=$1`, [e1])
    ).rows.length;
    await db.exec("reset role");
    await db.exec(migration);
    // Running the update again must neither duplicate learnings nor erase data.
    await db.exec(migration);
    await as(owner);
    const old = (
      await db.query<{ project_id: string; fields: Record<string, string> }>(
        `select project_id,fields from records where id=$1`,
        [e1],
      )
    ).rows[0];
    assert.equal(old.project_id, p1);
    assert.equal(old.fields.result, "Evidence");
    assert.equal(
      (
        await db.query(
          `select * from records where kind='learning' and parent_id=$1`,
          [e1],
        )
      ).rows.length,
      1,
    );
    assert.ok(
      (await db.query(`select * from audit_log where record_id=$1`, [e1])).rows
        .length >= auditBefore,
    );

    async function row(
      kind: string,
      project: string | null,
      parent: string | null = null,
      fields = {},
    ) {
      return (
        await db.query<{ id: string }>(
          `insert into records(workspace_id,project_id,kind,title,parent_id,owner_id,fields) values($1,$2,$3,$3,$4,$5,$6) returning id`,
          [w, project, kind, parent, owner, JSON.stringify(fields)],
        )
      ).rows[0].id;
    }
    const p2 = await row("project", null);
    const n2 = await row("north_star", p2);
    const g2 = await row("goal", p2, n2);
    assert.equal(
      (
        await db.query(
          `select * from records where kind='north_star' and workspace_id=$1`,
          [w],
        )
      ).rows.length,
      2,
    );
    await assert.rejects(row("north_star", p2));
    await assert.rejects(row("goal", p2, n1));
    const sub = await row("goal", p1, g1);
    await assert.rejects(
      db.query(`update records set parent_id=$1 where id=$2`, [sub, g1]),
    );
    await assert.rejects(row("experiment", p2, i1));
    await assert.rejects(row("experiment", n1));
    await assert.rejects(row("experiment", null));
    const e2 = await row("experiment", p2, null, {
      context: "C",
      traffic_plan: "50/50",
      impact: 5,
    });
    await assert.rejects(row("learning", p1, e2));
    await row("learning", p2, e2, { learning: "A result" });
    await assert.rejects(
      db.query(`update records set project_id=$1 where id=$2`, [p1, e2]),
    );
    for (const invalid of [0, 11, 1.5])
      await assert.rejects(row("experiment", p2, null, { impact: invalid }));
    await assert.rejects(row("experiment", p2, null, { start: "not-a-date" }));
    await db.query(`update records set fields=$1 where id=$2`, [
      JSON.stringify({
        context: "Edited",
        start: "2026-10-03",
        traffic_plan: "50/50",
        status: "Finalizado",
        variants: "invalid JSON",
        end: "2020-01-01",
        project_id: "invalid",
      }),
      e1,
    ]);
    assert.deepEqual(
      (
        await db.query<{ fields: unknown }>(
          `select fields from records where id=$1`,
          [e1],
        )
      ).rows[0].fields,
      { context: "Edited", start: "2026-10-03", traffic_plan: "50/50" },
    );
    assert.equal(
      (
        await db.query<{ actor_id: string }>(
          `select actor_id from audit_log where record_id=$1 order by created_at desc limit 1`,
          [e1],
        )
      ).rows[0].actor_id,
      owner,
    );
    for (let index = 0; index < 5; index++) {
      await row("opportunity", p1, g1, { focus: true });
      await row("opportunity", p2, g2, { focus: true });
    }
    await assert.rejects(row("opportunity", p1, g1, { focus: true }));
    await assert.rejects(row("opportunity", p2, g2, { focus: true }));

    const token = (
      await db.query<{ token: string }>(
        `select create_invitation($1,'viewer') as token`,
        [w],
      )
    ).rows[0].token;
    await as(viewer);
    await db.query(`select join_workspace($1)`, [token]);
    assert.equal(
      (
        await db.query(
          `update records set title='Forbidden' where id=$1 returning id`,
          [e2],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(row("experiment", p1));
    await assert.rejects(db.query(`select remove_member($1,$2)`, [w, owner]));
    await as(outsider);
    assert.equal(
      (await db.query(`select * from records where workspace_id=$1`, [w])).rows
        .length,
      0,
    );
    const w2 = (
      await db.query<{ id: string }>(`select create_workspace('B') as id`)
    ).rows[0].id;
    await assert.rejects(
      db.query(
        `insert into records(workspace_id,project_id,kind,title) values($1,$2,'experiment','Cross workspace')`,
        [w2, p1],
      ),
    );
    await as(owner);
    await db.query(`select remove_member($1,$2)`, [w, viewer]);
    await db.exec("reset role;set role anon");
    await assert.rejects(db.query(`select * from records`));
  } finally {
    await db.close();
  }
});

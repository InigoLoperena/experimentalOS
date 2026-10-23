import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

test('audit migration reindexes existing research and hypotheses, preserves private data and removes direct trigger grants', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text,email_confirmed_at timestamptz);
      create role anon; create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
      alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated;
      grant select on storage.objects to anon; grant select,insert,delete on storage.objects to authenticated;`);
    const dir = new URL('../supabase/migrations/', import.meta.url);
    const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
    const auditFile = files.find(f => f.includes('_audit_memory_fields_and_trigger_access'))!;
    for (const name of files.filter(f => f !== auditFile)) {
      await db.exec((await readFile(new URL(name, dir), 'utf8')).replace('create extension if not exists pgcrypto;', ''));
    }
    const owner = randomUUID(), outsider = randomUUID();
    for (const id of [owner, outsider]) await db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{}')", [id]);
    async function as(id: string) {
      await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec('set role authenticated');
    }
    const scalar = async <T = string>(sql: string, args: unknown[] = []) => (await db.query<{ value: T }>(sql, args)).rows[0].value;
    await as(owner);
    const workspace = await scalar("select create_team('QA isolated team') as value");
    const project = await scalar("insert into records(workspace_id,kind,title) values($1,'project','QA') returning id as value", [workspace]);
    const researchFields = { description: 'A small study', findings: 'interviewfindingaudit', method: 'Interviews', audience: 'Residents', api_key: 'not-in-memory' };
    const hypothesisFields = { belief: 'beliefaudit', reason: 'reasonaudit', validation_need: 'validationaudit', is_main_hypothesis: true };
    const ids: string[] = [];
    for (const [kind, fields] of [['research', researchFields], ['hypothesis', hypothesisFields]] as const) {
      ids.push(await scalar("insert into records(workspace_id,project_id,kind,title,fields) values($1,$2,$3,$3,$4) returning id as value", [workspace, project, kind, JSON.stringify(fields)]));
    }
    const original = await db.query('select * from records order by id');
    await db.exec('reset role');
    // Match the explicit grants found in production; revoking PUBLIC alone is insufficient.
    await db.exec('grant execute on function public.validate_mvp_record_links(),public.cleanup_mvp_record_links() to anon,authenticated');
    const migration = await readFile(new URL(auditFile, dir), 'utf8');
    await db.exec(migration); await db.exec(migration);
    assert.deepEqual((await db.query('select * from records order by id')).rows, original.rows);
    for (const fn of ['validate_mvp_record_links', 'cleanup_mvp_record_links']) {
      for (const role of ['anon', 'authenticated']) assert.equal(await scalar<boolean>(`select has_function_privilege('${role}','public.${fn}()','execute') as value`), false);
    }
    await as(owner);
    const memory = await scalar<{ sources: { id: string; excerpt: string; project_id: string }[] }>('select search_workspace_memory($1,$2) as value', [workspace, 'interviewfindingaudit beliefaudit']);
    const excerpts = memory.sources.filter(s => ids.includes(s.id)).map(s => s.excerpt).join('\n');
    for (const text of ['interviewfindingaudit', 'Interviews', 'Residents', 'beliefaudit', 'reasonaudit', 'validationaudit']) assert.ok(excerpts.includes(text), text);
    assert.ok(!excerpts.includes('not-in-memory'));
    assert.ok(memory.sources.every(s => s.project_id === project));
    await db.query("update records set fields=jsonb_set(fields,'{findings}','\"revisedfindingaudit\"') where id=$1", [ids[0]]);
    assert.match(await scalar("select excerpt as value from ai_memory_chunks where source_id=$1 limit 1", [ids[0]]), /revisedfindingaudit/);
    await db.query('delete from records where id=$1', [ids[0]]);
    assert.equal(await scalar<number>('select count(*)::int as value from ai_memory_chunks where source_id=$1', [ids[0]]), 0);
    await as(outsider);
    assert.equal((await scalar<{ sources: unknown[] }>('select search_workspace_memory($1,$2) as value', [workspace, 'beliefaudit'])).sources.length, 0);
  } finally { await db.close(); }
});

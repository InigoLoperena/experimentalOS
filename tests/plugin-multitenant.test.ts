import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { savePluginExperiment } from '../lib/plugin-save';
import { sealPluginDraft } from '../lib/plugin-draft';

// Translate the service's PostgREST queries into real SQL under the current
// authenticated role. No queued results: migrations, triggers and RLS all run.
function sqlClient(db: PGlite): SupabaseClient {
  const identifier = (name: string) => { assert.match(name, /^[a-z_]+$/); return `"${name}"`; };
  return { from(table: string) {
    let columns = '*', payload: Record<string, unknown> | undefined;
    const filters: [string, unknown][] = [];
    const execute = async (single: boolean) => {
      try {
        let sql: string, values: unknown[];
        if (payload) {
          const keys = Object.keys(payload);
          values = keys.map(k => typeof payload![k] === 'object' && payload![k] !== null ? JSON.stringify(payload![k]) : payload![k]);
          sql = `insert into public.${identifier(table)} (${keys.map(identifier).join(',')}) values (${values.map((_,i) => '$'+(i+1)).join(',')}) returning ${columns}`;
        } else {
          values = filters.map(([,value]) => value);
          sql = `select ${columns} from public.${identifier(table)}` + (filters.length ? ' where '+filters.map(([k],i) => identifier(k)+'=$'+(i+1)).join(' and ') : '');
        }
        const result = await db.query(sql, values);
        return { data: single ? result.rows[0] || null : result.rows, error: null };
      } catch (error) { return { data: null, error }; }
    };
    return {
      select(names = '*') { columns = names === '*' ? '*' : names.split(',').map(identifier).join(','); return this; },
      eq(name: string, value: unknown) { filters.push([name,value]); return this; },
      insert(value: Record<string, unknown>) { payload = value; return this; },
      single() { return execute(true); }, maybeSingle() { return execute(true); },
    };
  } } as unknown as SupabaseClient;
}

test('real plugin service plus complete SQL schema isolate accounts, onboard a new owner and deny foreign projects/viewers', async () => {
  const db = new PGlite();
  const previousKey = process.env.MCP_DRAFT_ENCRYPTION_KEY;
  process.env.MCP_DRAFT_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  try {
    await db.exec(`create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text,email_confirmed_at timestamptz);
      create role anon;create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
      alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;`);
    const dir = new URL('../supabase/migrations/', import.meta.url);
    const migrations = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
    const migrate = async (name: string) => db.exec((await readFile(new URL(name,dir),'utf8')).replace('create extension if not exists pgcrypto;',''));
    for (const name of migrations.filter(f => f < '005')) await migrate(name);
    const [a,b,viewer] = [randomUUID(),randomUUID(),randomUUID()];
    for (const id of [a,b,viewer]) await db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{\"name\":\"Test\"}')",[id]);
    const as = async (id: string) => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
      await db.exec('set role authenticated');
    };
    const scalar = async (sql: string, args: unknown[] = []) => (await db.query<{value:string}>(sql,args)).rows[0].value;
    await as(a); const wa = await scalar("select create_workspace('Account A') as value");
    await as(b); const wb = await scalar("select create_workspace('Account B') as value");
    await db.exec('reset role');
    for (const name of migrations.filter(f => f >= '005')) await migrate(name);
    await as(a); const pa = await scalar("insert into records(workspace_id,kind,title) values($1,'project','Project A') returning id as value",[wa]);
    const invitation = await scalar("select create_invitation($1,'viewer') as value",[wa]);
    await as(viewer); await db.query('select join_workspace($1)',[invitation]);
    await as(b); const pb = await scalar("insert into records(workspace_id,kind,title) values($1,'project','Project B') returning id as value",[wb]);
    const fields = {title:'Synthetic public plugin test',context:'Test only, no observed results',hypothesis:'3 of 10 agree to a pilot',metric:'Explicit commitments out of 10',success_criteria:'3 out of 10'};
    const token = sealPluginDraft(fields).token;
    const client = sqlClient(db);
    await as(a);
    const savedA = await savePluginExperiment(client,a,token,pa);
    assert.equal(savedA.saved,true);
    assert.equal((await savePluginExperiment(client,a,token,pa)).already_saved,true);
    await assert.rejects(savePluginExperiment(client,a,token,pb),/acceso/);
    await as(b);
    assert.equal((await db.query('select id from records where id=$1',[savedA.record_id])).rows.length,0);
    await assert.rejects(savePluginExperiment(client,b,token,pa),/acceso/);
    const savedB = await savePluginExperiment(client,b,token,pb);
    assert.notEqual(savedA.record_id,savedB.record_id);
    assert.equal((await savePluginExperiment(client,b,token,pb)).already_saved,true);
    const rowB = (await db.query<{workspace_id:string;owner_id:string;created_by:string;project_id:string}>('select * from records where id=$1',[savedB.record_id])).rows[0];
    assert.equal(rowB.workspace_id,wb); assert.equal(rowB.project_id,pb);
    assert.equal(rowB.owner_id,b); assert.equal(rowB.created_by,b);
    await as(viewer);
    await assert.rejects(savePluginExperiment(client,viewer,token,pa),/permiso/);
    await db.exec('reset role');
    const newcomer = randomUUID();
    await db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{\"name\":\"New user\"}')",[newcomer]);
    await as(newcomer);
    const ownSpace = await scalar("select create_team('New account team') as value");
    assert.notEqual(ownSpace,wa); assert.notEqual(ownSpace,wb);
    const ownProject = await scalar("insert into records(workspace_id,kind,title) values($1,'project','New account project') returning id as value",[ownSpace]);
    assert.equal((await savePluginExperiment(client,newcomer,token,ownProject)).saved,true);
    await assert.rejects(savePluginExperiment(client,newcomer,token,pa),/acceso/);
    await db.exec('reset role');
    assert.equal((await db.query<{n:number}>("select count(*)::int as n from records where kind='experiment'")).rows[0].n,3);
  } finally {
    if (previousKey === undefined) delete process.env.MCP_DRAFT_ENCRYPTION_KEY;
    else process.env.MCP_DRAFT_ENCRYPTION_KEY = previousKey;
    await db.close();
  }
});

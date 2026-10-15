import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

test('workspace account migration preserves legacy ciphertext and enforces owner-only profiles, tenant isolation and stale-write rejection',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text,email_confirmed_at timestamptz);create role anon;create role authenticated;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;`);
  const dir=new URL('../supabase/migrations/',import.meta.url),targetMigration='20261014180627_workspace_integrations_and_profiles.sql',files=(await readdir(dir)).filter(f=>f.endsWith('.sql')&&f<=targetMigration).sort(),last=targetMigration;
  for(const f of files.slice(0,-1))await db.exec((await readFile(new URL(f,dir),'utf8')).replace('create extension if not exists pgcrypto;',''));
  const owner=randomUUID(),other=randomUUID(),editor=randomUUID();for(const id of [owner,other,editor])await db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{}')",[id]);
  const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec(id?'set role authenticated':'set role anon');};
  const scalar=async(sql:string,args:unknown[]=[])=>((await db.query<{value:any}>(sql,args)).rows[0].value);
  await as(owner);const w=await scalar("select create_team('SQL workspace test') as value");
  const p=await scalar("insert into records(workspace_id,kind,title) values($1,'project','Origin') returning id as value",[w]),target=await scalar("insert into records(workspace_id,kind,title) values($1,'project','Target') returning id as value",[w]);
  const ciphertext='v1.'+'a'.repeat(60);
  const legacy=await scalar("select to_jsonb(r) as value from save_integration($1,$2,'metricool','{\"user_id\":\"123\",\"blog_id\":\"456\"}',array['api_key'],$3,null) r",[w,p,ciphertext]);
  const oldRevision=legacy.updated_at;await db.exec('reset role');await db.exec(await readFile(new URL(last,dir),'utf8'));await as(owner);
  assert.equal(await scalar('select workspace_default as value from integration_connections where id=$1',[legacy.id]),true);
  assert.equal(await scalar('select read_integration_envelope($1) as value',[legacy.id]),ciphertext);
  assert.equal(await scalar('select updated_at::text as value from integration_connections where id=$1',[legacy.id]),await scalar('select $1::timestamptz::text as value',[oldRevision]));
  const token=await scalar("select create_invitation($1,'editor') as value",[w]);await as(editor);await db.query('select join_workspace($1)',[token]);
  await assert.rejects(db.query("select save_integration_profile($1,$2,'metricool',$3,'{\"blog_id\":\"789\"}',null)",[w,target,legacy.id]),/superadministrador/);
  await as(owner);await db.query("select save_integration_profile($1,$2,'metricool',$3,'{\"blog_id\":\"789\"}',null)",[w,target,legacy.id]);
  const revision=await scalar("select updated_at as value from integration_project_profiles where project_id=$1",[target]);
  await assert.rejects(db.query("select save_integration_profile($1,$2,'metricool',$3,'{\"api_key\":\"unsafe\"}',$4)",[w,target,legacy.id,revision]),/Perfil no válido/);
  await assert.rejects(db.query("select save_integration_profile($1,$2,'metricool',$3,'{}',null)",[w,target,legacy.id]),/ha cambiado/);
  await as(other);assert.equal((await db.query('select * from integration_project_profiles')).rows.length,0);
  await assert.rejects(db.query('select choose_workspace_integration($1,$2)',[legacy.id,oldRevision]),/superadministrador/);
  await as(owner);
  const migrated=await scalar("select to_jsonb(r) as value from save_workspace_integration($1,$2,'metricool','{\"user_id\":\"123\",\"blog_id\":\"456\"}',array['api_key'],$3,$4) r",[w,legacy.id,'v1.'+'b'.repeat(60),oldRevision]);
  assert.equal(migrated.project_id,null);assert.equal(migrated.workspace_default,true);assert.notEqual(migrated.id,legacy.id);
  assert.equal(await scalar('select connection_id as value from integration_project_profiles where project_id=$1',[target]),migrated.id);
  assert.equal(await scalar('select read_integration_envelope($1) as value',[legacy.id]),ciphertext);
  // The new common connection survives deletion of its former source project.
  await db.query('select delete_project($1)',[p]);assert.equal(await scalar('select read_integration_envelope($1) as value',[migrated.id]),'v1.'+'b'.repeat(60));
  await as(editor);assert.equal((await db.query('select * from integration_connections where id=$1',[migrated.id])).rows.length,1);
  await assert.rejects(db.query('update integration_connections set enabled=false where id=$1',[migrated.id]));
  await as(null);await assert.rejects(db.query('select choose_workspace_integration($1,$2)',[migrated.id,migrated.updated_at]),/permission denied/);
 }finally{await db.close();}
});

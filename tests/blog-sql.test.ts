import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
test('public blog RLS reserves all editing for the approved verified account and never publishes drafts or leaks workspace data',async()=>{
 const db=new PGlite();try{
  await db.exec(`create schema auth;create schema experimental_private;create role anon;create role authenticated;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  const editor=randomUUID(),outsider=randomUUID(),unconfirmed=randomUUID();
  await db.query("insert into auth.users values($1,'InigoLoperena@gmail.com',now(),'{}'),($2,'another-workspace-owner@example.org',now(),'{\"site_admin\":true,\"email\":\"inigoloperena@gmail.com\"}'),($3,'unconfirmed@example.org',null,'{}')",[editor,outsider,unconfirmed]);
  await db.exec(await readFile(new URL('../supabase/migrations/20261024192857_public_blog.sql',import.meta.url),'utf8'));
  const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec(id?'set role authenticated':'set role anon');};
  const count=async()=>Number((await db.query<{n:number}>('select count(*) as n from blog_posts')).rows[0].n);
  const insert="insert into blog_posts(slug,title,excerpt,body_markdown,author_name) values('qa-draft','QA only','Resumen','## Método','Autora QA') returning id";
  await as(outsider);assert.equal((await db.query<{ok:boolean}>('select is_blog_editor() as ok')).rows[0].ok,false);await assert.rejects(db.query(insert),/row-level security/);await assert.rejects(db.query('insert into blog_editors(user_id) values($1)',[outsider]),/permission denied/);
  await as(editor);assert.equal((await db.query<{ok:boolean}>('select is_blog_editor() as ok')).rows[0].ok,true);
  const id=(await db.query<{id:string}>(insert)).rows[0].id;assert.equal(await count(),1);
  await assert.rejects(db.query("update blog_posts set published_at=now() where id=$1",[id]),/permission denied/);
  await as(null);assert.equal(await count(),0);await assert.rejects(db.query('select * from blog_posts'),/permission denied/);await assert.rejects(db.query('select is_blog_editor()'),/permission denied/);await assert.rejects(db.query('select * from blog_editors'),/permission denied/);
  await as(outsider);assert.equal(await count(),0);assert.equal((await db.query('update blog_posts set title=\'hijacked\' where id=$1 returning id',[id])).rows.length,0);
  await as(editor);await db.query("update blog_posts set status='published' where id=$1",[id]);
  await as(null);assert.equal(await count(),1);const published=(await db.query<{slug:string;published_at:string}>('select slug,published_at from blog_posts')).rows[0];assert.equal(published.slug,'qa-draft');assert.ok(published.published_at);
  await as(editor);await assert.rejects(db.query("update blog_posts set slug='break-link' where id=$1",[id]),/URL publicada/);await db.query("update blog_posts set status='draft' where id=$1",[id]);
  await as(null);assert.equal(await count(),0);
  await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=null where id=$1',[editor]);await as(editor);assert.equal((await db.query<{ok:boolean}>('select is_blog_editor() as ok')).rows[0].ok,false);assert.equal(await count(),0);await assert.rejects(db.query(insert.replace('qa-draft','unverified-draft')),/row-level security/);
  await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=now(),email=\'changed@example.org\' where id=$1',[editor]);await as(editor);assert.equal((await db.query<{ok:boolean}>('select is_blog_editor() as ok')).rows[0].ok,false);
  await db.exec('reset role');await db.query("update auth.users set email='inigoloperena@gmail.com' where id=$1",[editor]);await as(editor);await db.query('delete from blog_posts where id=$1',[id]);assert.equal(await count(),0);
 }finally{await db.close();}
});

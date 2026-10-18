import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {viewForPath,pathForView} from '../lib/section-routes';

test('anonymous landing and deep links support public read-only sections',()=>{
 assert.equal(viewForPath('/'), 'projects');
 for(const view of ['projects','experiments','learning','map','goals','input_metrics','opportunities','ideas','ai','method'] as const)
  assert.equal(viewForPath(pathForView(view)),view);
});

test('public SQL publishes all project record kinds, never private data',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261014101000_public_project_reader.sql',import.meta.url),'utf8');
 for(const kind of ['project','north_star','goal','opportunity','idea','experiment','learning'])
  assert.ok(sql.includes("'"+kind+"'"));
 for(const field of ['description','hypothesis','learning','success_criteria','evidence','metric','target'])
  assert.ok(sql.includes("'"+field+"'"));
 for(const field of ['execution_config','posthog_experiment_id','posthog_host','api_key','access_token'])
  assert.ok(!sql.includes("'"+field+"'"),'Private field exposed: '+field);
 for(const key of ['members','activity','attachments'])assert.ok(sql.includes("'"+key+"','[]'::jsonb"));
 assert.match(sql,/auth\.uid\(\) is not null then return null/);
 assert.doesNotMatch(sql,/to_jsonb\(r\)/);
 assert.doesNotMatch(sql,/set enabled\s*=\s*true/i);
});

test('public UI includes sidebar and keeps controls and services private',async()=>{
 const page=await readFile(new URL('../app/page.tsx',import.meta.url),'utf8');
 assert.match(page,/\{nav\.map\(\(\{ id, label, icon: I \}\) => \(/);
 assert.match(page,/view === "team" && !publicMode/);
 assert.match(page,/view === 'integrations' && !publicMode/);
 assert.match(page,/!publicMode && <PostHogProjectPanel/);
 assert.match(page,/!publicMode&&\['web_app'/);
 assert.match(page,/const can=\(kind:Kind,action:RecordAction\)=>!publicMode/);
 assert.match(page,/if \(window\.location\.pathname === "\/" \|\| !requestedSection\)/);
});

test('a visitor can refresh each recognized section URL',async()=>{
 const route=await readFile(new URL('../app/[...section]/page.tsx',import.meta.url),'utf8');
 assert.match(route,/import Home from/);
});

test('logged-out readers browse the real workspace, not the editable demo fixtures',async()=>{
 const page=await readFile(new URL('../app/page.tsx',import.meta.url),'utf8');
 assert.match(page,/Explorar proyectos reales · solo lectura/);
 assert.doesNotMatch(page,/onDemo=\{\(\) => \{ setAuthRequested\(false\); setDemo\(true\); \}\}/);
 assert.match(page,/onDemo=\{\(\) => \{[\s\S]*?getPublicPreview\(supabase!\)/);
 assert.match(page,/onClick=\{\(\) => requestAuth\("login"\)\}/);
 assert.match(page,/\{publicMode \? \(/);
 assert.match(page,/setPublicMode\(true\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {viewForPath,pathForView} from '../lib/section-routes';

test('root and /proyectos resolve to public projects',()=>{
 assert.equal(viewForPath('/'), 'projects');
 assert.equal(viewForPath('/proyectos'), 'projects');
 assert.equal(pathForView('projects'), '/proyectos');
});
test('public SQL exposes an allowlisted project summary without other records or member data',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261014100000_public_project_showcase.sql',import.meta.url),'utf8');
 assert.match(sql,/r\.kind='project'/);
 assert.match(sql,/r\.fields->>'description'/);
 assert.match(sql,/r\.fields->>'site_url'/);
 for(const key of ['members','activity','attachments'])assert.ok(sql.includes("'"+key+"','[]'::jsonb"));
 assert.match(sql,/auth\.uid\(\) is not null then return null/);
 assert.doesNotMatch(sql,/to_jsonb\(r\)/);
 assert.doesNotMatch(sql,/set enabled\s*=\s*true/i);
});
test('anonymous views omit internal navigation and project integrations',async()=>{
 const page=await readFile(new URL('../app/page.tsx',import.meta.url),'utf8');
 assert.match(page,/nav\.filter\(item=>!publicMode \|\| item\.id==="projects"\)/);
 assert.match(page,/!publicMode && <PostHogProjectPanel/);
 assert.match(page,/if \(publicMode\) \{ requestAuth\("signup"\); return; \}/);
 assert.match(page,/window\.history\.replaceState\(window\.history\.state,"","\/proyectos"\)/);
});

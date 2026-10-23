// Isolated browser QA: every Supabase/API request is fulfilled with synthetic
// fixtures. Never attach this runner to a real user browser or remote app.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sectionPaths } from '../lib/section-routes.ts';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_MODULE_PATH || '.', process.cwd()] }));
const base = process.env.TEST_APP_URL || 'http://127.0.0.1:3107';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use a local app only.');
const output = new URL('../.vercel/audit-2026-10-23/', import.meta.url);
await mkdir(output, { recursive: true });
const workspace = { id: '11111111-1111-4111-8111-111111111111', name: 'Equipo QA' };
const user = { id: '22222222-2222-4222-8222-222222222222', aud: 'authenticated', role: 'authenticated', email: 'qa@example.invalid', user_metadata: { name: 'QA' }, app_metadata: {}, created_at: '2026-10-23T00:00:00Z' };
const projectId = '33333333-3333-4333-8333-333333333333';
const otherProjectId = '44444444-4444-4444-8444-444444444444';
const now = '2026-10-23T10:00:00Z';
const mk = (id, kind, title, fields = {}, parent_id = null, project_id = projectId) => ({ id, kind, title, fields, parent_id, project_id: kind === 'project' ? null : project_id, workspace_id: workspace.id, related_id: null, owner_id: user.id, created_by: user.id, updated_by: user.id, created_at: now, updated_at: now });
const fixtureRecords = () => [
  mk(projectId, 'project', 'Proyecto QA', { north_star: 'Acciones útiles' }),
  mk(otherProjectId, 'project', 'Otro proyecto QA', { north_star: 'Visitas' }),
  mk('55555555-5555-4555-8555-555555555555', 'opportunity', 'Problema QA', { is_problemon: true, description: 'Problema sintético' }),
  mk('66666666-6666-4666-8666-666666666666', 'hypothesis', 'Hipótesis QA', { description: 'Hipótesis sintética', is_main_hypothesis: true, impact: 5, confidence: 5, ease: 5 }, '55555555-5555-4555-8555-555555555555'),
  mk('77777777-7777-4777-8777-777777777777', 'experiment', 'Experimento QA', { context: 'Contexto propio', hypothesis: 'Hipótesis propia', metric: 'Clics', channel: 'meta_ads', impact: 5, confidence: 5, ease: 5 }, '66666666-6666-4666-8666-666666666666'),
  mk('88888888-8888-4888-8888-888888888888', 'research', 'Investigación QA', { description: 'Notas de entrevista', method: 'Entrevistas', findings: 'Hallazgo sintético' }),
  mk('99999999-9999-4999-8999-999999999999', 'experiment', 'Solo otro proyecto', { metric: 'Visitas' }, null, otherProjectId),
];
let records = fixtureRecords();
let writes = 0;
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [], checks = [], unexpected = [];
page.on('pageerror', error => errors.push(error.message));
const member = { user_id: user.id, workspace_id: workspace.id, role: 'owner', permissions: [], profiles: { id: user.id, name: 'QA', avatar_url: null } };
const fakeJwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' })).toString('base64url'), 'synthetic-signature'].join('.');
await context.addInitScript(({ session, ref }) => { localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session)); }, { ref: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0], session: { user, access_token: fakeJwt, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 } });
const fixtureRoute = async route => {
  const request = route.request(), url = new URL(request.url()), method = request.method();
  const json = async (body, status = 200, extra = {}) => route.fulfill({ status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', ...extra }, body: JSON.stringify(body) });
  if (url.origin === new URL(base).origin) {
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/integrations') return json({ connections: [], profiles: [], can_configure: true, storage_ready: true });
    // Provider/UI side panels may query their state; no real provider is called.
    return json({ resources: [], variants: [], observations: [], preparations: [], knowledge: [], entries: [] });
  }
  if (!url.hostname.endsWith('.supabase.co')) { unexpected.push(url.origin); return route.abort(); }
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
  if (url.pathname.startsWith('/auth/')) return json({ user });
  const table = url.pathname.split('/').at(-1);
  if (url.pathname.includes('/rpc/')) {
    if (table === 'get_public_preview') return json({ workspace, records, members: [], activity: [], attachments: [] });
    if (table === 'save_experiment_preparation') {
      const body = request.postDataJSON(), payload = body.p_record;
      const record = { ...mk(payload.id, 'experiment', payload.title), ...payload, updated_at: new Date().toISOString() };
      records = [...records.filter(r => r.id !== record.id), record]; writes++; return json([record]);
    }
    return json([]);
  }
  let rows = table === 'records' ? records : table === 'workspaces' ? [workspace] : table === 'members' ? [member] : table === 'profiles' ? [member.profiles] : [];
  for (const [key, value] of url.searchParams) if (value.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === value.slice(3));
  if (method === 'POST' && table === 'records') {
    const body = request.postDataJSON(), payload = Array.isArray(body) ? body[0] : body;
    rows = [{ ...mk(payload.id, payload.kind, payload.title), ...payload }]; records.push(rows[0]); writes++;
  }
  if (method === 'PATCH' && table === 'records') {
    const payload = request.postDataJSON(); rows.forEach(row => Object.assign(row, payload, { updated_at: new Date().toISOString() })); writes++;
  }
  const single = request.headers().accept?.includes('vnd.pgrst.object');
  return json(single ? rows[0] || null : rows, 200, { 'Content-Range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` });
};
await context.route('**/*', fixtureRoute);
await page.addInitScript(() => {
  window.SpeechRecognition = class {
    start() { window.qaDictation = this; }
    stop() { this.onend?.(); }
  };
});

async function navigate(path) {
  const response = await page.goto(base + path);
  assert.equal(response.status(), 200, path);
  await page.locator('.app-shell').waitFor();
  await page.locator('main').waitFor();
}
try {
  await navigate('/experimentacion-mvps/hipotesis-principal');
  await page.getByRole('button', { name: 'Hipótesis QA', exact: true }).waitFor();
  checks.push('Authenticated fixture opens its workspace and selected project');
  for (const path of Object.values(sectionPaths)) { await navigate(path); checks.push(`Direct route ${path}`); }
  await navigate('/experimentacion-mvps/experimentos');
  assert.equal(await page.getByRole('button', { name: 'Solo otro proyecto', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Desplegar padres (2)', exact: true }).click();
  await page.getByRole('button', { name: 'Hipótesis QA', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Problema QA', exact: true }).waitFor();
  checks.push('Experiment ancestors expand with project-scoped shared IDs');
  await page.getByRole('button', { name: 'Añadir experimento', exact: true }).first().click();
  const editor = page.locator('dialog.edit-dialog[open]');
  await editor.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Experimento nuevo QA');
  await editor.getByRole('textbox', { name: 'Contexto', exact: true }).fill('Contexto escrito por una persona');
  await editor.getByRole('textbox', { name: 'Hipótesis', exact: true }).fill('Hipótesis nueva');
  await editor.getByRole('textbox', { name: 'Métrica principal', exact: true }).fill('Clics');
  await editor.getByRole('textbox', { name: 'Fecha de inicio', exact: true }).fill('2026-10-23');
  await editor.getByRole('textbox', { name: 'Fecha de finalización', exact: true }).fill('2026-10-22');
  await editor.getByRole('button', { name: 'Guardar ficha', exact: true }).click();
  await editor.getByRole('alert').filter({ hasText: 'La fecha final debe ser posterior al inicio.' }).waitFor();
  assert.equal(writes, 0, 'Invalid dates were saved');
  await editor.getByRole('textbox', { name: 'Fecha de finalización', exact: true }).fill('2026-10-24');
  checks.push('Invalid experiment dates are rejected before a write');
  await editor.getByRole('textbox', { name: 'Contexto', exact: true }).click();
  await editor.getByRole('button', { name: 'Dictar texto', exact: true }).click();
  await page.evaluate(() => window.qaDictation.onresult({ resultIndex: 0, results: [[{ transcript: 'contenido dictado' }]] }));
  await editor.getByRole('button', { name: 'Detener dictado', exact: true }).click();
  await editor.getByRole('textbox', { name: 'Métrica principal', exact: true }).click();
  assert.match(await editor.getByRole('textbox', { name: 'Contexto', exact: true }).inputValue(), /contenido dictado/);
  checks.push('Editor dictation updates the selected React field without microphone access');
  await editor.getByRole('button', { name: 'Guardar ficha', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  assert.ok(records.some(r => r.title === 'Experimento nuevo QA' && r.fields.context.includes('Contexto escrito por una persona') && r.fields.context.includes('contenido dictado')));
  checks.push('Create experiment saves typed fields through the existing RPC');
  const detail = page.locator('dialog.detail-dialog[open]');
  await detail.getByRole('button', { name: 'Editar ficha', exact: true }).click();
  await editor.getByRole('spinbutton', { name: 'Impacto (1–10)', exact: true }).fill('8');
  await editor.getByRole('button', { name: 'Guardar ficha', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  const edited = records.find(r => r.title === 'Experimento nuevo QA');
  assert.equal(Number(edited.fields.impact), 8);
  assert.match(edited.fields.context, /contenido dictado/);
  assert.equal(edited.parent_id, '66666666-6666-4666-8666-666666666666');
  checks.push('Editing ICE preserves experiment content and its shared hypothesis parent');
  await detail.getByRole('button', { name: 'Documentar aprendizaje', exact: true }).click();
  await editor.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Aprendizaje nuevo QA');
  await editor.getByRole('textbox', { name: 'Qué aprendimos', exact: true }).fill('Conclusión pendiente de revisión');
  await editor.getByRole('button', { name: 'Guardar ficha', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  assert.ok(records.some(r => r.kind === 'learning' && r.title === 'Aprendizaje nuevo QA' && r.parent_id === edited.id));
  checks.push('Documenting a learning preserves its experiment association');
  await navigate('/experimentacion-mvps/investigacion');
  await page.getByRole('button', { name: 'Añadir investigación', exact: true }).first().click();
  await editor.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Investigación nueva QA');
  await editor.getByRole('textbox', { name: 'Hallazgos', exact: true }).fill('Hallazgo de entrevista');
  await editor.getByRole('button', { name: 'Guardar ficha', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  assert.ok(records.some(r => r.title === 'Investigación nueva QA' && r.fields.findings === 'Hallazgo de entrevista'));
  checks.push('Create research saves findings without cloning a hypothesis or experiment');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/proyectos', '/experimentacion-mvps/hipotesis', '/experimentacion-mvps/experimentos', '/goi-tree', '/ia', '/integraciones']) {
    await navigate(path);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `Mobile page overflows: ${path}`);
    checks.push(`Mobile viewport fits ${path} at 390px`);
  }
  const publicContext = await browser.newContext();
  await publicContext.route('**/*', fixtureRoute);
  const reader = await publicContext.newPage();
  await reader.goto(base + '/goi-tree/experimentos');
  await reader.locator('.app-shell').waitFor();
  assert.equal(await reader.getByRole('button', { name: 'Crear', exact: true }).count(), 0);
  assert.equal(await reader.getByRole('button', { name: 'Editar ficha', exact: true }).count(), 0);
  await reader.getByRole('button', { name: 'Integraciones', exact: true }).click();
  await reader.locator('main > .panel').getByRole('button', { name: 'Crear mi espacio gratis', exact: true }).waitFor();
  assert.equal(await reader.getByRole('button', { name: 'Comprobar conexión', exact: true }).count(), 0);
  checks.push('Public reader cannot create/edit records or configure integration credentials');
  await publicContext.close();
  assert.deepEqual(errors, [], 'Uncaught browser errors');
  assert.deepEqual([...new Set(unexpected)], [], 'Unexpected external destination');
  await page.screenshot({ path: fileURLToPath(new URL('browser-local.png', output)), fullPage: true });
  console.log(JSON.stringify({ passed: checks.length, checks, fixtureWrites: writes, productionWrites: 0, browserErrors: errors }));
} catch (error) {
  await writeFile(new URL('failure-ui.txt', output), await page.locator('body').innerText());
  await writeFile(new URL('failure-overflow.json', output), JSON.stringify(await page.evaluate(() => ({ width: window.innerWidth, documentWidth: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 1).map(el => ({ tag: el.tagName, className: String(el.className), width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right })).slice(0,20) })), null, 2));
  await page.screenshot({ path: fileURLToPath(new URL('failure.png', output)), fullPage: true });
  throw error;
} finally {
  await writeFile(new URL('browser-report.json', output), JSON.stringify({ checks, fixtureWrites: writes, productionWrites: 0, errors, unexpected }, null, 2));
  await browser.close();
}

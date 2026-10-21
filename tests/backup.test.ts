import { test } from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { backupCsv, backupJson, recordPath, type Backup } from "../lib/backup";
import { readAllPages, fetchBackup } from "../lib/backup-service";
import { createBackupArchive } from "../lib/backup-archive";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "../lib/model";

const record = (id: string, kind: Item["kind"], project_id: string | null, fields = {}): Item => ({ id, kind, project_id, workspace_id: "w", parent_id: null, related_id: null, title: id, owner_id: "u", fields, created_at: "2026-10-04", updated_at: "2026-10-04", created_by: "u", updated_by: "u" });
export const sampleBackup: Backup = {
  schema_version: 4, exported_at: "2026-10-04T12:34:56.000Z", workspace_id: "w", notes: [],
  records: [record("Proyecto España", "project", null, { site_url: "https://example.com", north_star: "Compras semanales" }), record("Segundo proyecto", "project", null),
    record("North Star", "north_star", "Proyecto España", { definition: "Compras realizadas" }),
    { ...record("Goal retención", "goal", "Proyecto España", { target: 0 }), parent_id: "North Star" },
    { ...record("Oportunidad", "opportunity", "Proyecto España", { evidence: "Análisis; entrevistas" }), parent_id: "Goal retención" },
    { ...record("Idea", "idea", "Proyecto España", { description: "Mejorar el formulario" }), parent_id: "Oportunidad" },
    { ...record("=Experimento;\"A\"", "experiment", "Proyecto España", { hypothesis: 'Hipótesis; con "comillas"\ny nueva línea 🚀', current: 0, focus: false, tags: "=HYPERLINK(\"url\")" }), parent_id: "Idea" },
    { ...record("Aprendizaje acción", "learning", "Segundo proyecto", { learning: "Aprendimos algo", result: "+SUM(1,2)" }), related_id: "=Experimento;\"A\"" },
    record("Ficha huérfana", "learning", "proyecto-eliminado", { learning: "No perder" })],
  members: [{ user_id: "u", role: "owner", name: "Íñigo García" }, { user_id: "v", role: "viewer", name: "Lector" }],
  attachments: ["a", "b"].map(id => ({ id, record_id: "=Experimento;\"A\"", workspace_id: "w", name: "../mismo.png", kind: "image" as const, storage_path: "w/" + id, url: null, mime_type: "image/png", size: 3 })),
  audit: [{ id: "historial", action: "UPDATE", title: "Cambio", old_data: { fields: { context: "Contexto anterior" } }, new_data: { fields: { context: "Nuevo contexto" } } }],
  comments: [{ id: "comentario", record_id: "Goal retención", body: "=Comentario con evidencia", author_id: "u", author_name: "Íñigo García" }],
};
// Parse the actual spreadsheet output, including multiline cells and escaped quotes.
function parseCsv(source: string) {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 1; i < source.length; i++) {
    const c = source[i];
    if (c === '"') { if (quoted && source[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && c === ";") { row.push(cell); cell = ""; }
    else if (!quoted && c === "\r" && source[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += c;
  }
  return rows.slice(1).map(row => Object.fromEntries(rows[0].map((key, i) => [key, row[i]])));
}
test("CSV contains exactly four readable columns and only requested GOI and experiment kinds", () => {
  const output = backupCsv(sampleBackup);
  assert.ok(output.startsWith("\uFEFF"));
  assert.equal(output.slice(1).split("\r\n")[0], '"tipo";"proyecto";"padre";"nombre"');
  const rows = parseCsv(output);
  assert.equal(rows.length, 4);
  assert.ok(rows.every(row => Object.keys(row).join(",") === "tipo,proyecto,padre,nombre"));
  assert.deepEqual(rows.map(row => [row.tipo, row.proyecto, row.padre, row.nombre]), [
    ["Objetivo", "Proyecto España", "North Star", "Goal retención"],
    ["Oportunidad-problema", "Proyecto España", "Goal retención", "Oportunidad"],
    ["Idea", "Proyecto España", "Oportunidad", "Idea"],
    ["Experimento", "Proyecto España", "Idea", "'" + sampleBackup.records[6].title],
  ]);
  for(const excluded of ["datos_json", "grupo", "proyecto_id", "padre_id", "campo_", "Íñigo García", "Aprendizaje acción", "Segundo proyecto"]) {
    assert.ok(!output.includes(excluded), "Unexpected CSV content: " + excluded);
  }
  assert.equal(JSON.parse(backupJson(sampleBackup)).records.length, 9);
  assert.equal(recordPath(sampleBackup.records[6], sampleBackup.records), 'North Star / Goal retención / Oportunidad / Idea / =Experimento;"A"');
});

test("CSV groups projects alphabetically, distinguishes Input Metrics and leaves missing parents blank", () => {
  const projectA = {...record("project-a", "project", null), title:"Árbol"};
  const projectZ = {...record("project-z", "project", null), title:"Zorro"};
  const nsm = {...record("north-star", "north_star", "project-z"), title:"North Star"};
  const objective = {...record("objective", "goal", "project-z"), title:"Interés", parent_id:nsm.id};
  const metric = {...record("metric", "goal", "project-z", {goi_section:"input_metrics"}), title:"Usuarios registrados", parent_id:nsm.id};
  const orphanProblem = {...record("orphanProblem", "opportunity", "project-z"), title:"Problema huérfano"};
  const orphanIdea = {...record("orphanIdea", "idea", "project-z"), title:"Idea sin padre", parent_id:"missing"};
  const ideaA = {...record("ideaA", "idea", "project-a"), title:"Idea Árbol"};
  const experimentA = {...record("experimentA", "experiment", "project-a"), title:"Experimento Árbol", parent_id:ideaA.id};
  const extra = {...sampleBackup, records:[metric, orphanIdea, projectZ, experimentA, nsm, objective, orphanProblem, projectA, ideaA]};
  const rows = parseCsv(backupCsv(extra));
  assert.deepEqual(rows.map(row => row.proyecto), ["Árbol","Árbol","Zorro","Zorro","Zorro","Zorro"]);
  assert.deepEqual(rows.map(row => row.tipo), ["Idea","Experimento","Objetivo","Input Metric","Oportunidad-problema","Idea"]);
  assert.equal(rows.find(row=>row.nombre==="Interés")?.padre,"North Star");
  assert.equal(rows.find(row=>row.nombre==="Usuarios registrados")?.padre,"North Star");
  assert.equal(rows.find(row=>row.nombre==="Problema huérfano")?.padre,"");
  assert.equal(rows.find(row=>row.nombre==="Idea sin padre")?.padre,"");
  assert.equal(rows.find(row=>row.nombre==="Experimento Árbol")?.padre,"Idea Árbol");
});

test("pagination exports beyond 1000 rows, including a server cap below requested page size", async () => {
  const all = Array.from({ length: 1203 }, (_, id) => ({ id })); const offsets: number[] = [];
  const rows = await readAllPages(async (from, to) => { offsets.push(from); return { data: all.slice(from, Math.min(to + 1, from + 100)), error: null, count: all.length }; });
  assert.deepEqual(rows, all); assert.deepEqual(offsets, Array.from({ length: 13 }, (_, i) => i * 100));
});
test("failed, truncated or changing queries cannot silently return an incomplete copy", async () => {
  await assert.rejects(readAllPages(async from => ({ data: from ? null : [{ id: 1 }], error: from ? { message: "Acceso denegado" } : null, count: 2 })), /Acceso denegado/);
  await assert.rejects(readAllPages(async from => ({ data: from ? [] : [{ id: 1 }], error: null, count: 2 })), /incompleta/);
  await assert.rejects(readAllPages(async from => ({ data: [{ id: 1 }], error: null, count: from ? 3 : 2 })), /han cambiado/);
});
test("the full-data service scopes every query to the authenticated workspace and reads profile/audit fields", async () => {
  const queries: { name: string; select?: string; scope?: string; order?: string; orders?: string[] }[] = [];
  const tables: Record<string, unknown[]> = { records: sampleBackup.records, members: sampleBackup.members.map(m => ({ ...m, profiles: { name: m.name, avatar_url: null, updated_at: "today" } })), audit_log: sampleBackup.audit, record_attachments: sampleBackup.attachments, record_comments: sampleBackup.comments! };
  const client = { from(name: string) {
    const query = { name } as typeof queries[number]; queries.push(query);
    return { select(select: string, options: { count: string }) { query.select = select; assert.equal(options.count, "exact"); return this; },
      eq(key: string, value: string) { assert.equal(key, "workspace_id"); query.scope = value; return this; },
      order(key: string) { query.order = key; (query.orders ||= []).push(key); return this; }, range(from: number, to: number) { return Promise.resolve({ data: tables[name].slice(from, to + 1), count: tables[name].length, error: null }); } };
  } } as unknown as SupabaseClient;
  tables.experiment_specs=[{experiment_id:'e',workspace_id:'w',project_id:'p',code:'EXP-P-0001'}];
  tables.experiment_variants=[]; tables.external_resources=[]; tables.metric_observations=[{id:'m',workspace_id:'w',experiment_id:'e',metric:'clicks',value:12}];
  tables.meta_campaign_preparations=[]; tables.meta_preparation_runs=[];
  tables.meta_preparation_steps=[{request_id:'request',run_id:'run',status:'succeeded',result:{id:'123'}}];
  tables.integration_connections=[{id:'connection',provider:'meta',config:{account_id:'123'}}];
  tables.ai_knowledge=[{id:'knowledge',title:'Entrevista',content:'Información cualitativa',project_id:'p',validation:'unverified'}];
  tables.google_ads_preparations=[{experiment_id:'e',request_id:'g',campaign_id:'123',status:'linked'}];
  tables.smartlead_preparations=[{experiment_id:'e',request_id:'s',campaign_id:'456',status:'linked'}];
  tables.ai_chat_entries=[{id:'chat',project_id:'p',user_id:'u',question:'Pregunta',answer:'Respuesta'}];
  tables.ai_preparation_usage=[{request_id:'usage',user_id:'u',reserved_usd:0.03,model:'gpt-4o-mini-transcribe-2025-12-15'}];
  tables.ai_documents=[];tables.provider_result_snapshots=[];tables.posthog_preparations=[];
  // Integration profiles have no "id": their primary key is (project_id, provider).
  tables.integration_project_profiles=[{workspace_id:'w',project_id:'p',provider:'posthog',connection_id:'connection',config:{project_name:'demo'},updated_at:'today'}];
  tables.ai_knowledge_revisions=[];
  const backup = await fetchBackup(client, "w");
  assert.equal(queries.length, 23); assert.ok(queries.every(q => q.scope === "w"));
  assert.equal(JSON.parse(backupJson(backup)).monitoring.ai_knowledge[0].content,'Información cualitativa');
  assert.equal(backup.schema_version,8); assert.equal(backup.monitoring?.metric_observations[0].value,12);
  for(const table of ['google_ads_preparations','smartlead_preparations','ai_chat_entries','ai_preparation_usage']){
    assert.deepEqual(JSON.parse(backupJson(backup)).monitoring[table],tables[table]);
    assert.ok(!backupCsv(backup).includes(table));
  }
  assert.ok(backup.notes.some(note=>note.includes('conversaciones de otros miembros permanecen privadas')));
  assert.equal(backup.monitoring?.meta_preparation_steps[0].request_id,'request');
  assert.ok(backup.notes.some(note=>note.includes('no se exportan')));
  assert.ok(!backupCsv(backup).includes('EXP-P-0001')); assert.equal(JSON.parse(backupJson(backup)).monitoring.metric_observations[0].metric,'clicks');
  assert.equal(queries.find(q => q.name === "members")?.select, "*,profiles(*)");
  assert.deepEqual(backup.records, sampleBackup.records); assert.deepEqual(backup.audit, sampleBackup.audit);
  assert.deepEqual(backup.comments, sampleBackup.comments);
  assert.equal(backup.members[0].name, "Íñigo García");
  assert.deepEqual(queries.find(q => q.name === "integration_project_profiles")?.orders,["project_id","provider"]);
  assert.deepEqual(queries.find(q => q.name === "meta_preparation_steps")?.orders,["run_id","step_key"]);
  assert.deepEqual(backup.monitoring?.integration_project_profiles,tables.integration_project_profiles);
  assert.deepEqual(JSON.parse(backupJson(backup)).monitoring.integration_project_profiles,tables.integration_project_profiles);
});
test("ZIP preserves structured data and original files with identical names without collisions", async () => {
  const downloaded: string[] = [];
  const backup = { ...sampleBackup, attachments: [...sampleBackup.attachments, { ...sampleBackup.attachments[0], id: "link", kind: "link" as const, storage_path: null, url: "https://example.com", size: null }] };
  const bytes = await createBackupArchive(backup, "copia.csv", new TextEncoder().encode(backupCsv(backup)), async a => { downloaded.push(a.id); return new Uint8Array([1, 2, a.id === "a" ? 3 : 4]); }, () => {});
  const files = unzipSync(bytes); const originals = Object.entries(files).filter(([name]) => name.startsWith("adjuntos/"));
  assert.equal(originals.length, 2); assert.ok(originals.every(([name]) => !name.includes("../")));
  assert.deepEqual(downloaded, ["a", "b"]); assert.deepEqual(originals.map(([, file]) => Array.from(file)), [[1, 2, 3], [1, 2, 4]]);
  assert.deepEqual(JSON.parse(strFromU8(files["datos-completos.json"])), backup);
  assert.deepEqual(files["copia.csv"], new TextEncoder().encode(backupCsv(backup)));
  await assert.rejects(createBackupArchive(backup, "copia.csv", new Uint8Array([1]), async () => new Uint8Array([1]), () => {}), /no se ha generado/);
});

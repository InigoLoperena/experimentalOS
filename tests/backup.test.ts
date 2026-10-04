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
test("CSV preserves every project, field, relation, profile and audit payload safely", () => {
  const output = backupCsv(sampleBackup); assert.ok(output.startsWith("\uFEFF"));
  const rows = parseCsv(output);
  assert.equal(rows.length, 1 + sampleBackup.records.length + sampleBackup.members.length + sampleBackup.attachments.length + sampleBackup.audit.length);
  for (const r of sampleBackup.records) assert.deepEqual(JSON.parse(rows.find(x => JSON.parse(x.datos_json).id === r.id && x.grupo !== "Historial")!.datos_json), r);
  const experiment = rows.find(x => x.grupo === "Experimentos")!;
  assert.equal(experiment.nombre, "'=Experimento;\"A\"");
  assert.equal(experiment.campo_hypothesis, sampleBackup.records[6].fields.hypothesis);
  assert.equal(experiment.campo_current, "0"); assert.equal(experiment.campo_focus, "false");
  assert.ok(experiment.campo_tags.startsWith("'="));
  assert.equal(rows.filter(x => x.grupo === "Equipo")[0].nombre, "Íñigo García");
  assert.deepEqual(JSON.parse(rows.find(x => x.grupo === "Historial")!.datos_json), sampleBackup.audit[0]);
  assert.equal(JSON.parse(backupJson(sampleBackup)).records.length, 9);
  assert.equal(recordPath(sampleBackup.records[6], sampleBackup.records), 'North Star / Goal retención / Oportunidad / Idea / =Experimento;"A"');
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
  const queries: { name: string; select?: string; scope?: string; order?: string }[] = [];
  const tables: Record<string, unknown[]> = { records: sampleBackup.records, members: sampleBackup.members.map(m => ({ ...m, profiles: { name: m.name, avatar_url: null, updated_at: "today" } })), audit_log: sampleBackup.audit, record_attachments: sampleBackup.attachments };
  const client = { from(name: string) {
    const query = { name } as typeof queries[number]; queries.push(query);
    return { select(select: string, options: { count: string }) { query.select = select; assert.equal(options.count, "exact"); return this; },
      eq(key: string, value: string) { assert.equal(key, "workspace_id"); query.scope = value; return this; },
      order(key: string) { query.order = key; return this; }, range(from: number, to: number) { return Promise.resolve({ data: tables[name].slice(from, to + 1), count: tables[name].length, error: null }); } };
  } } as unknown as SupabaseClient;
  const backup = await fetchBackup(client, "w");
  assert.equal(queries.length, 4); assert.ok(queries.every(q => q.scope === "w"));
  assert.equal(queries.find(q => q.name === "members")?.select, "*,profiles(*)");
  assert.deepEqual(backup.records, sampleBackup.records); assert.deepEqual(backup.audit, sampleBackup.audit);
  assert.equal(backup.members[0].name, "Íñigo García");
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

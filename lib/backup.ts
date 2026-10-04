import { kinds, type Item, type Member } from "./model";
import type { Attachment } from "./attachments";
import { experimentFields } from "./experiments";

export type Backup = {
  schema_version: 4; exported_at: string; workspace_id: string;
  records: Item[]; members: Member[]; attachments: Attachment[];
  audit: Record<string, unknown>[]; notes: string[];
};
export const fieldLabels: Record<string, string> = {
  ...Object.fromEntries(experimentFields.map(f => [f.key, f.label])),
  site_url: "Web del proyecto", north_star: "North Star Metric", analytics_url: "Enlace a Analytics",
  tasks_url: "Otro enlace 1", meeting_notes_url: "Otro enlace 2", other_url: "Otro enlace 3",
  definition: "Definición y regla de cálculo", value_moment: "Momento de valor", frequency: "Frecuencia",
  baseline: "Valor inicial", current: "Valor actual", target: "Objetivo", unit: "Unidad", source: "Fuente / enlace",
  stage: "Etapa del Product Hackers Canvas", opportunity_type: "Tipo de oportunidad", evidence: "Evidencia",
  focus: "Oportunidad prioritaria", description: "Descripción", experimental_focus: "Foco experimental",
  result: "Qué ocurrió / resultado", learning: "Qué aprendimos", decision: "Decisión", next_steps: "Qué haremos después", period: "Periodo",
};
export const roleLabels: Record<string, string> = { owner: "Administrador", editor: "Editor", viewer: "Lector" };
export function displayValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
export function recordPath(record: Item, records: Item[]): string {
  const byId = new Map(records.map(r => [r.id, r]));
  const path = [record.title], seen = new Set([record.id]);
  let parent = record.parent_id;
  while (parent && !seen.has(parent)) {
    seen.add(parent); const next = byId.get(parent);
    if (!next) { path.unshift(parent); break; }
    path.unshift(next.title); parent = next.parent_id;
  }
  return path.join(" / ");
}
export function backupJson(backup: Backup): string { return JSON.stringify(backup, null, 2); }
export function csvCell(value: unknown): string {
  let text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  // Spreadsheet applications must treat user-supplied values as text, never formulas.
  if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function backupCsv(backup: Backup): string {
  const fields = [...new Set(backup.records.flatMap(r => Object.keys(r.fields || {})))].sort();
  const header = ["grupo", "tipo", "id", "proyecto_id", "proyecto", "padre_id", "padre", "relacionado_id", "responsable_id", "responsable", "nombre", "rol", "creado", "actualizado", "creado_por", "actualizado_por", "datos_json", ...fields.map(f => "campo_" + f)];
  const rows: Record<string, unknown>[] = [];
  const records = new Map(backup.records.map(r => [r.id, r]));
  const members = new Map(backup.members.map(m => [m.user_id, m]));
  rows.push({ grupo: "Exportación", tipo: "Metadatos", id: backup.workspace_id, creado: backup.exported_at,
    datos_json: { schema_version: backup.schema_version, exported_at: backup.exported_at, workspace_id: backup.workspace_id, notes: backup.notes } });
  for (const r of backup.records) {
    const row: Record<string, unknown> = { grupo: r.kind === "project" ? "Proyectos" : r.kind === "experiment" ? "Experimentos" : r.kind === "learning" ? "Aprendizajes" : "GOI Tree", tipo: kinds[r.kind] || r.kind,
      id: r.id, proyecto_id: r.project_id, proyecto: records.get(r.project_id || "")?.title, padre_id: r.parent_id,
      padre: records.get(r.parent_id || "")?.title, relacionado_id: r.related_id, responsable_id: r.owner_id,
      responsable: members.get(r.owner_id || "")?.name, nombre: r.title, creado: r.created_at, actualizado: r.updated_at,
      creado_por: r.created_by, actualizado_por: r.updated_by, datos_json: r };
    for (const key of fields) row["campo_" + key] = r.fields[key];
    rows.push(row);
  }
  for (const m of backup.members) rows.push({ grupo: "Equipo", tipo: "Miembro", id: m.user_id, nombre: m.name, rol: roleLabels[m.role] || m.role, datos_json: m });
  for (const a of backup.attachments) {
    const record = records.get(a.record_id);
    rows.push({ grupo: "Adjuntos", tipo: a.kind, id: a.id, nombre: a.name, padre_id: a.record_id, padre: record?.title,
      proyecto_id: record?.project_id, proyecto: records.get(record?.project_id || "")?.title, creado: a.created_at, creado_por: a.created_by, datos_json: a });
  }
  for (const a of backup.audit) rows.push({ grupo: "Historial", tipo: a.action, id: a.id, nombre: a.title, creado: a.created_at, creado_por: a.actor_id, responsable: a.actor_name, datos_json: a });
  return "\uFEFF" + [header.map(csvCell).join(";"), ...rows.map(row => header.map(key => csvCell(row[key])).join(";"))].join("\r\n") + "\r\n";
}
export function backupName(backup: Backup) { return "experimental-os-copia-" + backup.exported_at.replace(/[:.]/g, "-"); }
export function archiveName(value: string) { return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/^\.+/, "_").slice(0, 130) || "archivo"; }

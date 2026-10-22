import { kinds, type Item, type Member } from "./model";
import type { Attachment } from "./attachments";
import { experimentFields } from "./experiments";

export type Backup = {
  schema_version: 4 | 5 | 6 | 7 | 8; exported_at: string; workspace_id: string;
  records: Item[]; members: Member[]; attachments: Attachment[];
  audit: Record<string, unknown>[]; notes: string[];
  comments?: Record<string, unknown>[];
  monitoring?: Record<string, Record<string, unknown>[]>;
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
/**
 * Human-readable CSV of the GOI Tree and experiments. Unlike the JSON backup,
 * this intentionally exports no IDs, account information or auxiliary tables.
 */
export function backupCsv(backup: Pick<Backup, "records">): string {
  // This is a *list*, not a backup. It must never expose auxiliary records
  // or additional fields, even if the workspace contains them.
  const header = ["Tipo", "Proyecto", "Padre", "Nombre"];
  const byId = new Map(backup.records.map(item => [item.id, item]));
  const projectName = (item: Item): string | null => {
    const project = byId.get(item.project_id || "");
    return project?.kind === "project" ? project.title : null;
  };
  const classification = (item: Item): {label: string; order: number} | null => {
    if (item.kind === "goal" && item.fields.goi_section !== "input_metrics")
      return { label: "Objetivo", order: 0 };
    if (item.kind === "opportunity") {
      // The stored kind combines both concepts. Never guess by title:
      // an explicitly classified problem is a Problema; otherwise Oportunidad.
      const type = String(item.fields.opportunity_type || "").trim().toLocaleLowerCase("es");
      return type === "problema" || type === "problem"
        ? { label: "Problema", order: 2 }
        : { label: "Oportunidad", order: 1 };
    }
    if (item.kind === "hypothesis") return { label: "Hipótesis", order: 3 };
    if (item.kind === "experiment") return { label: "Experimento", order: 4 };
    return null;
  };
  const compare = (a: string, b: string) =>
    a.localeCompare(b, "es", {sensitivity: "base"});
  const rows = backup.records
    .filter(item => classification(item) !== null && projectName(item) !== null)
    .sort((a, b) =>
      compare(projectName(a)!, projectName(b)!) ||
      classification(a)!.order - classification(b)!.order ||
      compare(a.title, b.title) || a.id.localeCompare(b.id))
    .map(item => {
      const parent = byId.get(item.parent_id || "");
      return [
        classification(item)!.label,
        projectName(item)!,
        parent && parent.project_id === item.project_id ? parent.title : "",
        item.title,
      ];
    });
  return "\uFEFF" + [header, ...rows].map(row => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

export function backupName(backup: Backup) { return "experimental-os-copia-" + backup.exported_at.replace(/[:.]/g, "-"); }
export function archiveName(value: string) { return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/^\.+/, "_").slice(0, 130) || "archivo"; }

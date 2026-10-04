import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { displayValue, fieldLabels, recordPath, roleLabels, type Backup } from "./backup";
import { kinds, type Item } from "./model";
import { pdfFontRanges } from "./export-font-coverage";

export function pdfText(value: unknown): string {
  return Array.from(displayValue(value)).map(char => {
    const code = char.codePointAt(0)!;
    if (char === "\n" || char === "\r" || char === "\t") return char;
    return pdfFontRanges.some(([from, to]) => code >= from && code <= to) ? char : `[U+${code.toString(16).toUpperCase()}]`;
  }).join("");
}
function base64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
type Assets = { regular: Uint8Array; bold: Uint8Array; logo: Uint8Array };
async function loadAssets(): Promise<Assets> {
  const get = async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error("No se han podido cargar los recursos del PDF. Vuelve a intentarlo.");
    return new Uint8Array(await response.arrayBuffer());
  };
  const [regular, bold, logo] = await Promise.all([get("/export-fonts/DejaVuSans.ttf"), get("/export-fonts/DejaVuSans-Bold.ttf"), get("/imagine-builder-logo.png")]);
  return { regular, bold, logo };
}
export async function createBackupPdf(backup: Backup, providedAssets?: Assets): Promise<Uint8Array> {
  const assets = providedAssets || await loadAssets();
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS("Backup.ttf", base64(assets.regular)); doc.addFont("Backup.ttf", "Backup", "normal");
  doc.addFileToVFS("BackupBold.ttf", base64(assets.bold)); doc.addFont("BackupBold.ttf", "Backup", "bold");
  doc.setFont("Backup");
  doc.setProperties({ title: "Experimental Operative System - Copia completa", author: "Imagine Builder", subject: "Proyectos, GOI Tree, experimentos, aprendizajes y equipo" });
  let y = 44;
  const table = (title: string, rows: unknown[][]) => {
    if (y > 248) { doc.addPage(); y = 44; }
    autoTable(doc, { startY: y, margin: { top: 44, bottom: 18, left: 14, right: 14 }, theme: "grid",
      head: [[{ content: pdfText(title), colSpan: 2 }]], body: rows.map(row => row.map(pdfText)),
      styles: { font: "Backup", fontSize: 8, cellPadding: 2.5, overflow: "linebreak", textColor: [36, 36, 36], lineColor: [217, 217, 217], lineWidth: .15 },
      headStyles: { fillColor: [32, 32, 32], textColor: [183, 255, 76], fontStyle: "bold", fontSize: 10 },
      columnStyles: { 0: { cellWidth: 47, fontStyle: "bold", fillColor: [245, 245, 245] }, 1: { cellWidth: 135 } },
      rowPageBreak: "avoid", showHead: "everyPage",
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  };
  const memberNames = new Map(backup.members.map(m => [m.user_id, m.name]));
  const byId = new Map(backup.records.map(r => [r.id, r]));
  const recordRows = (record: Item): unknown[][] => [
    ["ID", record.id], ["Responsable", memberNames.get(record.owner_id || "") || record.owner_id || "Sin asignar"],
    ["ID del responsable", record.owner_id], ["Proyecto", byId.get(record.project_id || "")?.title || ""], ["ID del proyecto", record.project_id],
    ["Elemento padre", byId.get(record.parent_id || "")?.title || ""], ["ID del padre", record.parent_id], ["Registro relacionado", record.related_id],
    ["Ruta en el árbol", recordPath(record, backup.records)],
    ...Object.entries(record.fields || {}).map(([key, value]) => [fieldLabels[key] || key, value]),
    ["Creado", record.created_at], ["Actualizado", record.updated_at],
    ["Creado por", record.created_by_name || memberNames.get(record.created_by || "") || record.created_by], ["ID del creador", record.created_by],
    ["Actualizado por", record.updated_by_name || memberNames.get(record.updated_by || "") || record.updated_by], ["ID de quien actualizó", record.updated_by],
    ...Object.entries(record).filter(([key]) => !["id", "kind", "workspace_id", "project_id", "parent_id", "related_id", "title", "owner_id", "fields", "created_at", "updated_at", "created_by", "updated_by", "created_by_name", "updated_by_name"].includes(key)).map(([key, value]) => [key, value]),
  ];
  table("Copia completa del sistema", [
    ["Fecha de exportación (UTC)", backup.exported_at], ["ID del equipo interno", backup.workspace_id],
    ["Proyectos", backup.records.filter(r => r.kind === "project").length], ["Experimentos", backup.records.filter(r => r.kind === "experiment").length],
    ["Aprendizajes", backup.records.filter(r => r.kind === "learning").length], ["Elementos del GOI Tree", backup.records.filter(r => !["project", "experiment", "learning"].includes(r.kind)).length],
    ["Equipo", backup.members.length], ["Adjuntos y enlaces", backup.attachments.length], ["Historial", backup.audit.length],
    ["Alcance", "Todos los proyectos. Los filtros de la pantalla no se aplican."],
    ["Archivos originales", "Para conservar también imágenes, PDF y DOCX, activa Incluir archivos adjuntos originales al exportar. Se guardan en el ZIP."],
    ["Datos reutilizables", "El CSV conserva las columnas y los datos completos. El ZIP incluye además una copia estructurada en JSON. El PDF es una copia de consulta; no restaura cuentas ni contraseñas."],
    ["Símbolos", "Los símbolos no disponibles en la fuente se representan por su código Unicode [U+...], sin perder su identidad."],
    ...backup.notes.map(note => ["Nota", note]),
  ]);
  table("Equipo", backup.members.length ? backup.members.map(m => [m.name, `ID: ${m.user_id}\nRol: ${roleLabels[m.role] || m.role}${m.avatar_url ? "\nFoto: " + (m.avatar_url.startsWith("data:") ? "Incluida en el detalle del perfil." : m.avatar_url) : ""}`]) : [["Equipo", "Sin miembros"]]);
  for (const member of backup.members) {
    const profile = (member as typeof member & { profiles?: Record<string, unknown> }).profiles;
    const rows: unknown[][] = Object.entries(member).filter(([key]) => !["avatar_url", "profiles"].includes(key)).map(([key, value]) => [key, value]);
    if (profile) rows.push(...Object.entries(profile).filter(([key]) => key !== "avatar_url").map(([key, value]) => ["Perfil: " + key, value]));
    if (member.avatar_url && !member.avatar_url.startsWith("data:")) rows.push(["Foto / enlace", member.avatar_url]);
    table("Perfil: " + member.name, rows);
    if (member.avatar_url?.startsWith("data:image/")) {
      if (y > 250) { doc.addPage(); y = 44; }
      const image = doc.getImageProperties(member.avatar_url);
      const height = 20 * image.height / image.width;
      doc.addImage(member.avatar_url, image.fileType, 14, y, 20, Math.min(height, 24)); y += Math.min(height, 24) + 8;
    }
  }
  const projects = backup.records.filter(r => r.kind === "project");
  const projectIds = new Set(projects.map(p => p.id));
  const groups: { title: string; project?: Item; records: Item[] }[] = projects.map(project => ({ title: project.title, project, records: backup.records.filter(r => r.project_id === project.id) }));
  const unassigned = backup.records.filter(r => r.kind !== "project" && !projectIds.has(r.project_id || ""));
  if (unassigned.length) groups.push({ title: "Registros sin proyecto asignado", records: unassigned });
  let count = 0;
  for (const group of groups) {
    doc.addPage(); y = 44;
    if (group.project) table("Proyecto: " + group.title, recordRows(group.project));
    else table(group.title, [["Registros", group.records.length]]);
    const tree = group.records.filter(r => !["experiment", "learning"].includes(r.kind));
    const experiments = group.records.filter(r => r.kind === "experiment");
    const learnings = group.records.filter(r => r.kind === "learning");
    table("GOI Tree - estructura y relaciones", group.records.length ? group.records.map(r => [kinds[r.kind] || r.kind, `${recordPath(r, backup.records)}\nID: ${r.id}`]) : [["GOI Tree", "Sin registros"]]);
    for (const records of [tree, experiments, learnings]) for (const r of records) {
      table((kinds[r.kind] || r.kind) + ": " + r.title, recordRows(r));
      if (++count % 25 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  if (backup.attachments.length) {
    doc.addPage(); y = 44;
    for (const a of backup.attachments) table("Adjunto: " + a.name, [
      ["Ficha", byId.get(a.record_id)?.title || a.record_id], ["ID de la ficha", a.record_id],
      ...Object.entries(a).filter(([key]) => key !== "preview_url").map(([key, value]) => [key, value]),
    ]);
  }
  if (backup.audit.length) {
    doc.addPage(); y = 44;
    for (const a of backup.audit) table("Historial: " + displayValue(a.title), Object.entries(a).map(([key, value]) => [key, value]));
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFillColor(32, 32, 32); doc.rect(0, 0, 210, 34, "F");
    doc.addImage(assets.logo, "PNG", 14, 6, 54, 18);
    doc.setFont("Backup", "bold"); doc.setFontSize(11); doc.setTextColor(183, 255, 76);
    doc.text("Experimental Operative System", 78, 15); doc.setFont("Backup", "normal"); doc.setFontSize(8); doc.setTextColor(245, 245, 245);
    doc.text("Copia completa - Imagine Builder", 78, 22);
    doc.setDrawColor(183, 255, 76); doc.setLineWidth(.8); doc.line(14, 35, 196, 35);
    doc.setDrawColor(210, 210, 210); doc.setLineWidth(.2); doc.line(14, 282, 196, 282);
    doc.setTextColor(100, 100, 100); doc.setFontSize(7);
    doc.text(backup.exported_at, 14, 287); doc.text(`Página ${page} de ${pages}`, 196, 287, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

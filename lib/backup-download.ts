import { backupCsv, backupJson, backupName, type Backup } from "./backup";
import type { Attachment } from "./attachments";

export async function downloadBackup(snapshot: Backup, format: "csv" | "pdf" | "json", originals: boolean,
  downloadAttachment: (attachment: Attachment) => Promise<Uint8Array>, progress: (message: string) => void) {
  progress(format === "pdf" ? "Preparando el documento PDF…" : "Preparando los datos…");
  let bytes: Uint8Array;
  if (format === "pdf") {
    const { createBackupPdf } = await import("./backup-pdf");
    bytes = await createBackupPdf(snapshot);
  } else bytes = new TextEncoder().encode(format === "csv" ? backupCsv(snapshot) : backupJson(snapshot));
  let filename = backupName(snapshot) + "." + format;
  let mime = format === "pdf" ? "application/pdf" : format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8";
  if (originals) {
    const { createBackupArchive } = await import("./backup-archive");
    bytes = await createBackupArchive(snapshot, filename, bytes, downloadAttachment, progress);
    filename = backupName(snapshot) + ".zip"; mime = "application/zip";
  }
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

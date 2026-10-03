import type { Kind } from "./model";

export const attachmentBucket = "record-attachments";
export const attachmentLimit = 10 * 1024 * 1024;
export type Attachment = {
  id: string; record_id: string; workspace_id: string; name: string;
  kind: "image" | "pdf" | "docx" | "link";
  storage_path: string | null; url: string | null; mime_type: string | null;
  size: number | null; created_by?: string | null; created_at?: string;
  preview_url?: string;
};
export function supportsAttachments(kind: Kind) {
  return ["experiment", "learning", "north_star", "goal", "opportunity", "idea"].includes(kind);
}
export function attachmentFileType(file: Pick<File, "name" | "size" | "type">) {
  if (!file.size || file.size > attachmentLimit) throw new Error("Cada archivo debe pesar entre 1 byte y 10 MB.");
  if (!file.name.trim() || file.name.length > 250) throw new Error("El nombre del archivo es demasiado largo.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const types: Record<string, { kind: Attachment["kind"]; mime: string }> = {
    jpg: { kind: "image", mime: "image/jpeg" }, jpeg: { kind: "image", mime: "image/jpeg" },
    png: { kind: "image", mime: "image/png" }, webp: { kind: "image", mime: "image/webp" }, gif: { kind: "image", mime: "image/gif" },
    pdf: { kind: "pdf", mime: "application/pdf" },
    docx: { kind: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  };
  const type = types[extension];
  if (!type || (file.type && file.type !== type.mime && !(extension === "docx" && ["application/zip", "application/octet-stream"].includes(file.type))))
    throw new Error("Adjunta una imagen JPG, PNG, WebP o GIF, un PDF o un documento DOCX.");
  return { ...type, extension };
}
export function attachmentLink(value: string) {
  const url = value.trim();
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || url.length > 2000 || /\s/.test(url)) throw Error();
    return parsed.href;
  } catch { throw new Error("Introduce un enlace válido que empiece por https:// o http://."); }
}

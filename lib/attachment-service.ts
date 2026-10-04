import { supabase } from "./supabase";
import { attachmentBucket, attachmentFileType, attachmentLink, type Attachment } from "./attachments";

function failure(error: { code?: string; message: string }) {
  if (["42P01", "PGRST205", "PGRST202"].includes(error.code || "") || /bucket not found/i.test(error.message))
    return new Error("Falta activar los adjuntos en Supabase. Sigue el enlace de ayuda y vuelve a intentarlo.");
  return new Error(error.message);
}
export async function loadAttachments(recordId: string) {
  const r = await supabase!.from("record_attachments").select("*").eq("record_id", recordId).order("created_at");
  if (r.error) throw failure(r.error);
  return r.data as Attachment[];
}
export async function addFileAttachment(recordId: string, workspaceId: string, file: File) {
  const type = attachmentFileType(file);
  const id = crypto.randomUUID();
  const path = `${workspaceId}/${recordId}/${id}.${type.extension}`;
  const attachment: Attachment = { id, record_id: recordId, workspace_id: workspaceId, name: file.name,
    kind: type.kind, storage_path: path, mime_type: type.mime, url: null, size: file.size };
  const inserted = await supabase!.from("record_attachments").insert(attachment).select().single();
  if (inserted.error) throw failure(inserted.error);
  const uploaded = await supabase!.storage.from(attachmentBucket).upload(path, file, { contentType: type.mime, upsert: false });
  if (uploaded.error) {
    await supabase!.from("record_attachments").delete().eq("id", id);
    throw failure(uploaded.error);
  }
  return inserted.data as Attachment;
}
export async function addLinkAttachment(recordId: string, workspaceId: string, label: string, value: string, client = supabase!) {
  const url = attachmentLink(value);
  const r = await client.from("record_attachments").insert({ record_id: recordId, workspace_id: workspaceId,
    name: label.trim() || new URL(url).hostname, kind: "link", url }).select().single();
  if (r.error) throw failure(r.error);
  return r.data as Attachment;
}
export async function removeAttachment(attachment: Attachment) {
  if (attachment.storage_path) {
    const r = await supabase!.storage.from(attachmentBucket).remove([attachment.storage_path]);
    if (r.error) throw failure(r.error);
  }
  const r = await supabase!.from("record_attachments").delete().eq("id", attachment.id).select("id");
  if (r.error) throw failure(r.error);
  if (!r.data?.length) throw new Error("No tienes permiso para retirar este adjunto. Actualiza la ficha.");
  await cleanupAttachments();
}
// Insert the replacement before retiring the original; failed writes keep the old link.
// This uses the existing insert/delete policies without adding UPDATE privileges.
export async function saveLinkSlot(record: Pick<import("./model").Item, "id" | "workspace_id">, slot: number, value: string, previous?: Attachment, client = supabase!) {
  const url = value.trim() ? attachmentLink(value) : "";
  if ((previous?.url === url && previous.name === `Link ${slot + 1}`) || (!previous && !url)) return previous;
  const next = url ? await addLinkAttachment(record.id, record.workspace_id, `Link ${slot + 1}`, url, client) : undefined;
  if (previous) {
    const removed = await client.from("record_attachments").delete().eq("id", previous.id).eq("record_id", record.id).eq("kind", "link").select("id");
    if (removed.error || !removed.data?.length) {
      if (next) await client.from("record_attachments").delete().eq("id", next.id).eq("record_id", record.id);
      throw new Error(removed.error?.message || "El enlace ha cambiado o no tienes permiso para editarlo. Actualiza la ficha.");
    }
  }
  return next;
}
export async function signedAttachmentUrl(path: string) {
  const r = await supabase!.storage.from(attachmentBucket).createSignedUrl(path, 300);
  if (r.error) throw failure(r.error);
  return r.data.signedUrl;
}
export async function cleanupAttachments() {
  if (!supabase) return;
  const queued = await supabase.from("attachment_deletions").select("id,storage_path").limit(100);
  // La aplicación sigue funcionando mientras se activa la actualización.
  if (queued.error) {
    if (["42P01", "PGRST205"].includes(queued.error.code)) return;
    throw failure(queued.error);
  }
  if (!queued.data?.length) return;
  const removed = await supabase.storage.from(attachmentBucket).remove(queued.data.map(row => row.storage_path));
  if (removed.error) throw failure(removed.error);
  const cleared = await supabase.from("attachment_deletions").delete().in("id", queued.data.map(row => row.id));
  if (cleared.error) throw failure(cleared.error);
  if (queued.data.length === 100) await cleanupAttachments();
}

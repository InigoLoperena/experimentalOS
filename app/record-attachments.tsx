"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Link2, Paperclip, Trash2 } from "lucide-react";
import type { Item } from "@/lib/model";
import { attachmentFileType, attachmentLink, type Attachment } from "@/lib/attachments";
import { addFileAttachment, addLinkAttachment, loadAttachments, removeAttachment, signedAttachmentUrl } from "@/lib/attachment-service";

function AttachmentPreview({ attachment, demo }: { attachment: Attachment; demo: boolean }) {
  const [url, setUrl] = useState(attachment.url || attachment.preview_url || "");
  const [error, setError] = useState("");
  const [pdf, setPdf] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!attachment.storage_path || demo) return;
    let active = true;
    const sign = async () => {
      try { const next = await signedAttachmentUrl(attachment.storage_path!); if (active) { setUrl(next); setError(""); } }
      catch (err) { if (active) { setUrl(""); setError(err instanceof Error ? err.message : "No se ha podido abrir este adjunto."); } }
    };
    void sign();
    // Renueva el enlace mientras la ficha permanece abierta.
    const timer = window.setInterval(() => void sign(), 240000);
    return () => { active = false; window.clearInterval(timer); };
  }, [attachment.storage_path, demo, retry]);
  return <>
    {attachment.kind === "image" && url && <a href={url} target="_blank" rel="noreferrer" className="attachment-image"><img src={url} alt={attachment.name} loading="lazy" /></a>}
    <div className="attachment-info">
      {attachment.kind === "link" ? <Link2 size={18} /> : <FileText size={18} />}
      <div><strong>{attachment.name}</strong><span className="small">{attachment.kind === "link" ? attachment.url : `${attachment.kind.toUpperCase()} · ${Math.ceil((attachment.size || 0) / 1024)} KB`}</span></div>
    </div>
    {url && <div className="attachment-actions"><a href={url} target="_blank" rel="noreferrer">{attachment.kind === "link" ? "Abrir enlace" : "Abrir / descargar"}</a>
      {attachment.kind === "pdf" && <button type="button" onClick={() => setPdf(!pdf)}>{pdf ? "Cerrar vista previa" : "Vista previa del PDF"}</button>}
    </div>}
    {attachment.kind === "pdf" && pdf && url && <iframe className="attachment-pdf" src={url} title={`Vista previa de ${attachment.name}`} />}
    {!url && !error && <p className="small">Cargando adjunto…</p>}
    {error && <div role="alert" className="error"><p>{error}</p><button type="button" onClick={() => setRetry(retry + 1)}>Reintentar</button></div>}
  </>;
}

export function RecordAttachments({ record, editable, demo, values, onDemoChange, onBusy }: {
  record: Item; editable: boolean; demo: boolean; values: Attachment[];
  onDemoChange: (values: Attachment[]) => void; onBusy: (busy: boolean) => void;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>(demo ? values : []);
  const [label, setLabel] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let active = true;
    if (!demo) {
      setLoading(true);
      void loadAttachments(record.id).then(next => { if (active) { setAttachments(next); setError(""); } })
        .catch(err => { if (active) setError(err.message); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; alive.current = false; };
  }, [record.id, demo, retry]);
  const update = (next: Attachment[]) => { setAttachments(next); if (demo) onDemoChange(next); };
  async function operation(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); onBusy(true); setError("");
    try { await action(); }
    catch (err) { if (alive.current) setError(err instanceof Error ? err.message : "No se ha podido guardar el adjunto."); }
    finally { if (alive.current) setBusy(false); onBusy(false); }
  }
  return <section className="record-attachments" aria-label="Adjuntos de la ficha">
    <h3><Paperclip size={18} /> Archivos y enlaces</h3>
    {loading && <p role="status" className="small">Cargando adjuntos…</p>}
    {!loading && !attachments.length && !error && <p className="small">Todavía no hay adjuntos.</p>}
    <div className="attachment-grid">
      {attachments.map(attachment => <article className="attachment-card" key={attachment.id}>
        <AttachmentPreview attachment={attachment} demo={demo} />
        {editable && <button type="button" className="attachment-remove" disabled={busy} aria-label={`Retirar ${attachment.name}`}
          onClick={() => {
            if (!window.confirm(`¿Retirar «${attachment.name}» de esta ficha?`)) return;
            void operation(async () => { if (!demo) await removeAttachment(attachment); update(attachments.filter(item => item.id !== attachment.id)); });
          }}><Trash2 size={14} /> Retirar</button>}
      </article>)}
    </div>
    {editable && <div className="attachment-controls">
      <p className="small">Los adjuntos se guardan al añadirlos. Imágenes, PDF o DOCX · hasta 10 MB por archivo.</p>
      <label className="attachment-upload">Adjuntar archivos
        <input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx" disabled={busy || loading}
          onChange={e => {
            const files = Array.from(e.target.files || []); e.target.value = "";
            if (!files.length) return;
            void operation(async () => {
              for (const file of files) attachmentFileType(file);
              let next = [...attachments];
              for (const file of files) {
                const item = demo ? { id: crypto.randomUUID(), record_id: record.id, workspace_id: record.workspace_id,
                  name: file.name, kind: attachmentFileType(file).kind, storage_path: null, url: null,
                  mime_type: attachmentFileType(file).mime, size: file.size, preview_url: URL.createObjectURL(file) } as Attachment
                  : await addFileAttachment(record.id, record.workspace_id, file);
                next = [...next, item]; update(next);
              }
            });
          }} />
      </label>
      <div className="attachment-link-fields">
        <label>Nombre del enlace (opcional)<input maxLength={250} value={label} disabled={busy} onChange={e => setLabel(e.target.value)} /></label>
        <label>Enlace<input type="url" maxLength={2000} placeholder="https://" value={link} disabled={busy} onChange={e => setLink(e.target.value)} /></label>
        <button type="button" className="btn" disabled={busy || loading || !link.trim()} onClick={() => void operation(async () => {
          const url = attachmentLink(link);
          const item = demo ? { id: crypto.randomUUID(), record_id: record.id, workspace_id: record.workspace_id,
            name: label.trim() || new URL(url).hostname, kind: "link", storage_path: null, url, mime_type: null, size: null } as Attachment
            : await addLinkAttachment(record.id, record.workspace_id, label, url);
          update([...attachments, item]); setLabel(""); setLink("");
        })}>Añadir enlace</button>
      </div>
    </div>}
    {busy && <p role="status">Guardando adjuntos…</p>}
    {error && <div role="alert" className="error"><p>{error}</p>
      {error.includes("activar los adjuntos") && <a href="https://github.com/InigoLoperena/experimentalOS/blob/main/ACTIVAR-ADJUNTOS.md" target="_blank" rel="noreferrer">Cómo activar los adjuntos</a>}
      <button type="button" disabled={busy} onClick={() => setRetry(retry + 1)}>Actualizar adjuntos</button>
    </div>}
  </section>;
}

"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FileText, Link2, Paperclip, Trash2 } from "lucide-react";
import type { Item } from "@/lib/model";
import { attachmentFileType, attachmentLink, linkSlots, type Attachment } from "@/lib/attachments";
import { addFileAttachment, saveLinkSlot, loadAttachments, removeAttachment, signedAttachmentUrl } from "@/lib/attachment-service";

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

export function RecordAttachments({ record, editable, demo, prefetched = false, values, onDemoChange, onBusy, persisted = true, children }: {
  record: Item; editable: boolean; demo: boolean; prefetched?: boolean; values: Attachment[];
  onDemoChange: (values: Attachment[]) => void; onBusy: (busy: boolean) => void;
  persisted?: boolean; children?: (sections: { files: ReactNode; links: ReactNode }) => ReactNode;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>(demo || prefetched ? values : []);
  const [urls, setUrls] = useState<string[]>(() => linkSlots(demo || prefetched ? values : []).slots.map(a => a?.url || ""));
  const [linksSaved, setLinksSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!demo && !prefetched && persisted);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let active = true;
    if (prefetched) {
      setAttachments(values);
      setUrls(linkSlots(values).slots.map(a => a?.url || ""));
      setLoading(false);
    } else if (!demo && persisted) {
      setLoading(true);
      void loadAttachments(record.id).then(next => { if (active) { setAttachments(next); setUrls(linkSlots(next).slots.map(a => a?.url || "")); setError(""); } })
        .catch(err => { if (active) setError(err.message); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; alive.current = false; };
  }, [record.id, demo, prefetched, persisted, retry, values]);
  const update = (next: Attachment[]) => { setAttachments(next); if (demo) onDemoChange(next); };
  async function operation(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); onBusy(true); setError("");
    try { await action(); }
    catch (err) { if (alive.current) setError(err instanceof Error ? err.message : "No se ha podido guardar el adjunto."); }
    finally { if (alive.current) setBusy(false); onBusy(false); }
  }
  const { slots, extra } = linkSlots(attachments);
  const savedUrls = JSON.stringify(slots.map(a => a?.url || ""));
  const errorDisplay = error && <div role="alert" className="error"><p>{error}</p>
    {error.includes("activar los adjuntos") && <a href="https://github.com/InigoLoperena/experimentalOS/blob/main/ACTIVAR-ADJUNTOS.md" target="_blank" rel="noreferrer">Cómo activar los adjuntos</a>}
    <button type="button" disabled={busy} onClick={() => setRetry(retry + 1)}>Actualizar archivos y enlaces</button>
  </div>;
  const remove = (attachment: Attachment) => {
    if (!window.confirm(`¿Retirar «${attachment.name}» de esta ficha?`)) return;
    void operation(async () => { if (!demo) await removeAttachment(attachment); update(attachments.filter(item => item.id !== attachment.id)); });
  };
  const links = <section className="record-attachments record-links" aria-label="Enlaces de la ficha">
    <h3><Link2 size={18} /> Enlaces</h3>
    {loading && <p role="status" className="small">Cargando enlaces…</p>}
    <div className="attachment-link-fields">
      {slots.map((attachment, index) => editable ? <label key={index}>Link {index + 1}
        <input aria-label={`Link ${index + 1}`} type="url" maxLength={2000} placeholder="https://" value={urls[index]} disabled={!persisted || busy || loading}
          onChange={e => { setLinksSaved(false); setUrls(prev => prev.map((value, i) => i === index ? e.target.value : value)); }} />
        {attachment?.url && <a href={attachment.url} target="_blank" rel="noreferrer">Abrir Link {index + 1}</a>}
      </label> : <div key={index}><strong>Link {index + 1}</strong><p>{attachment?.url ? <a href={attachment.url} target="_blank" rel="noreferrer">{attachment.url}</a> : "Sin enlace"}</p></div>)}
      {editable && persisted && <button type="button" className="btn" disabled={busy || loading || savedUrls === JSON.stringify(urls)} onClick={() => void operation(async () => {
        const normalized = urls.map(url => url.trim() ? attachmentLink(url) : "");
        let next = [...attachments];
        for (let index = 0; index < 3; index++) {
          const previous = slots[index], url = normalized[index];
          if ((previous?.url || "") === url && (!previous || previous.name === `Link ${index + 1}`)) continue;
          const replacement = demo ? url ? { id: crypto.randomUUID(), record_id: record.id, workspace_id: record.workspace_id,
            name: `Link ${index + 1}`, kind: "link", storage_path: null, url, mime_type: null, size: null } as Attachment : undefined
            : await saveLinkSlot(record, index, url, previous);
          next = next.filter(a => a.id !== previous?.id);
          if (replacement) next.push(replacement);
          update(next);
        }
        setUrls(normalized); setLinksSaved(true);
      })}>Guardar enlaces</button>}
    </div>
    {!persisted && <p className="small">Guarda la ficha para añadir sus enlaces. Se abrirá automáticamente.</p>}
    {editable && persisted && <p className="small">Los enlaces se guardan con «Guardar enlaces». Deja un apartado vacío para retirar su enlace.</p>}
    {linksSaved && <p role="status" className="small">Enlaces guardados.</p>}
    {extra.length > 0 && <><h4>Otros enlaces existentes</h4><div className="attachment-grid">{extra.map(attachment => <article className="attachment-card" key={attachment.id}>
      <AttachmentPreview attachment={attachment} demo={demo} />
      {editable && <button type="button" className="attachment-remove" disabled={busy} aria-label={`Retirar ${attachment.name}`} onClick={() => remove(attachment)}><Trash2 size={14} /> Retirar</button>}
    </article>)}</div></>}
    {busy && <p role="status">Guardando…</p>}
    {errorDisplay}
  </section>;
  const files = <section className="record-attachments" aria-label="Archivos de la ficha">
    <h3><Paperclip size={18} /> Archivos</h3>
    {loading && <p role="status" className="small">Cargando archivos…</p>}
    {!loading && !attachments.some(a => a.kind !== "link") && !error && <p className="small">Todavía no hay archivos.</p>}
    <div className="attachment-grid">
      {attachments.filter(a => a.kind !== "link").map(attachment => <article className="attachment-card" key={attachment.id}>
        <AttachmentPreview attachment={attachment} demo={demo} />
        {editable && <button type="button" className="attachment-remove" disabled={busy} aria-label={`Retirar ${attachment.name}`} onClick={() => remove(attachment)}><Trash2 size={14} /> Retirar</button>}
      </article>)}
    </div>
    {editable && persisted && <div className="attachment-controls">
      <p className="small">Los archivos se guardan al añadirlos. Imágenes, PDF o DOCX · hasta 10 MB por archivo.</p>
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
    </div>}
    {!persisted && <p className="small">Guarda la ficha para adjuntar imágenes, PDF o DOCX.</p>}
    {errorDisplay}
  </section>;
  return children ? children({ files, links }) : <>{links}{files}</>;
}

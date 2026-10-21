"use client";
import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";

export type BackupFormat = "csv" | "pdf" | "json";
export function BackupDialog({ onClose, onExport }: {
  onClose: () => void;
  onExport: (format: BackupFormat, originals: boolean, progress: (message: string) => void) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<BackupFormat>("csv");
  const [originals, setOriginals] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="backup-dialog" aria-labelledby="backup-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className="dialog-head">
      <div><span className="eyebrow">EXPORTACIÓN</span><h2 id="backup-title">Exportar datos del espacio</h2></div>
      <button className="icon-button" aria-label="Cerrar exportación" disabled={busy} onClick={onClose}><X size={20} /></button>
    </div>
    <form onSubmit={async e => {
      e.preventDefault(); if (busy) return;
      setBusy(true); setError(""); setProgress("Recopilando todos los datos…");
      try { await onExport(format, originals, setProgress); setProgress("Copia descargada."); }
      catch (err) { setError(err instanceof Error ? err.message : "No se ha podido generar la copia. Vuelve a intentarlo."); setProgress(""); }
      finally { setBusy(false); }
    }}>
      <div className="backup-content">
      <p>{format === "csv"
          ? "El CSV incluye solo tipo, proyecto, padre y nombre para objetivos, Input Metrics, oportunidades-problemas, ideas y experimentos, ordenados por proyecto."
          : "El PDF o JSON conserva los registros y datos asociados del espacio de trabajo, sin aplicar filtros de pantalla."}</p>
        <label>Formato de la copia
          <select value={format} disabled={busy} onChange={e => setFormat(e.target.value as BackupFormat)}>
            <option value="csv">CSV · abrir en Excel o Sheets</option>
            <option value="pdf">PDF · consultar, guardar o imprimir</option>
            <option value="json">JSON · conservar los datos estructurados</option>
          </select>
        </label>
        <label className="check-label"><input type="checkbox" checked={originals} disabled={busy} onChange={e => setOriginals(e.target.checked)} />Incluir archivos adjuntos originales</label>
        <p className="small">{originals
          ? "Se descargará un ZIP con el documento elegido, una copia completa en JSON y los archivos adjuntos originales."
          : format === "csv"
            ? "El CSV es un resumen para Excel o Sheets; para una copia completa selecciona JSON."
            : "Activa la casilla para conservar también los archivos adjuntos originales."}</p>
        <p className="small">Conserva esta copia en un lugar seguro. No incluye contraseñas ni restaura automáticamente las cuentas de acceso.</p>
        {progress && <p className="backup-progress" role="status" aria-live="polite">{progress}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <div className="dialog-foot"><button type="button" className="btn" disabled={busy} onClick={onClose}>Cerrar</button><button className="btn primary" disabled={busy}><Download size={16} />{busy ? "Preparando copia…" : "Descargar copia"}</button></div>
    </form>
  </dialog>;
}

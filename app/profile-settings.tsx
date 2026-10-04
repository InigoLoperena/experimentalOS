"use client";
import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

export type PersonalProfile = { name: string; avatar_url?: string | null };
export function Avatar({ name, photo }: {
  name: string; photo?: string | null;
}) {
  return <span className="avatar">
    {photo ? <img src={photo} alt={`Foto de ${name}`} /> : name.trim().charAt(0).toUpperCase() || "?"}
  </span>;
}

async function preparePhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Selecciona una imagen JPG, PNG o WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("La imagen debe pesar menos de 5 MB.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se ha podido leer la imagen."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se ha podido abrir la imagen."));
    img.src = data;
  });
  const size = Math.min(384 / image.width, 384 / image.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * size));
  canvas.height = Math.max(1, Math.round(image.height * size));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se ha podido preparar la imagen.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const photo = canvas.toDataURL("image/webp", 0.8);
  if (photo.length > 400000) throw new Error("Prueba con una imagen más pequeña.");
  return photo;
}

function PhotoField({ label, name, value, onChange, disabled, onBusy }: {
  label: string; name: string; value: string; onChange: (value: string) => void;
  disabled: boolean; onBusy: (busy: boolean) => void;
}) {
  const id = useId();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  return <div className="photo-field full">
    <Avatar name={name} photo={value} />
    <label htmlFor={id}>{label}
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || processing}
        onChange={async e => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError(""); setProcessing(true); onBusy(true);
          try { onChange(await preparePhoto(file)); }
          catch (err) { setError(err instanceof Error ? err.message : "No se ha podido cargar la imagen."); }
          finally { setProcessing(false); onBusy(false); }
        }} />
      <span className="small">JPG, PNG o WebP · hasta 5 MB</span>
    </label>
    {value && <button type="button" className="btn" disabled={disabled || processing} onClick={() => onChange("")}>Quitar {label.toLowerCase()}</button>}
    {processing && <p role="status">Preparando imagen…</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </div>;
}

const pendingMessage = "Para guardar perfiles, ejecuta la actualización 003_profiles_and_company.sql de Supabase indicada en el repositorio y recarga la página.";

export function ProfileDialog({ profile, ready, onSave, onClose }: {
  profile: PersonalProfile; ready: boolean;
  onSave: (profile: PersonalProfile) => Promise<void>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(profile.name);
  const [photo, setPhoto] = useState(profile.avatar_url || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="profile-dialog" aria-labelledby="profile-title" onCancel={e => {
    e.preventDefault(); if (!busy && !uploading) onClose();
  }}>
    <form onSubmit={async e => {
      e.preventDefault(); if (busy || uploading || !ready) return;
      setBusy(true); setError("");
      try { await onSave({ name: name.trim(), avatar_url: photo || null }); onClose(); }
      catch (err) { setError(err instanceof Error ? err.message : "No se ha podido guardar tu perfil."); }
      finally { setBusy(false); }
    }}>
      <div className="dialog-head row"><h2 id="profile-title">Mi perfil</h2>
        <button type="button" className="icon-button" aria-label="Cerrar perfil" disabled={busy || uploading} onClick={onClose}><X /></button>
      </div>
      <div className="form-body">
        {!ready && <p className="notice full" role="status">{pendingMessage}</p>}
        <label className="full">Nombre
          <input required maxLength={100} value={name} disabled={busy || !ready} onChange={e => setName(e.target.value)} />
        </label>
        <PhotoField label="Foto" name={name} value={photo} onChange={setPhoto} disabled={busy || !ready} onBusy={setUploading} />
        {error && <p className="error full" role="alert">{error}</p>}
      </div>
      <div className="dialog-foot">
        <button type="button" className="btn" disabled={busy || uploading} onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={busy || uploading || !ready}>{busy ? "Guardando…" : "Guardar perfil"}</button>
      </div>
    </form>
  </dialog>;
}

"use client";
import { useEffect, useState } from "react";
import { BrandIdentity } from "./brand-identity";
import { supabase } from "@/lib/supabase";

export function TeamAccess({ onAccepted, error: loadError }: {
  onAccepted: () => Promise<void>; error: string;
}) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("invite") || ""); }, []);
  return <div className="auth-shell">
    <div className="auth-card">
      <BrandIdentity />
      <h1>Acceso al equipo</h1>
      <p className="access-description">Tu cuenta está creada. Pide al administrador un enlace de invitación para acceder a los proyectos del equipo.</p>
      <form onSubmit={async e => {
        e.preventDefault(); if (busy) return;
        setBusy(true); setError("");
        try {
          const value = token.trim();
          const code = value.includes("://") ? new URL(value).searchParams.get("invite") || "" : value;
          const result = await supabase!.rpc("join_workspace", { invite_token: code });
          if (result.error) throw new Error(result.error.message);
          await onAccepted();
          window.history.replaceState({}, "", window.location.pathname);
        } catch (err) { setError(err instanceof Error ? err.message : "No se ha podido aceptar la invitación."); }
        finally { setBusy(false); }
      }}>
        <label>Enlace o código de invitación
          <input required value={token} disabled={busy} onChange={e => setToken(e.target.value)} />
        </label>
        <button className="btn primary" disabled={busy}>{busy ? "Abriendo el equipo…" : "Acceder al equipo"}</button>
      </form>
      {(error || loadError) && <p className="error" role="alert">{error || loadError}</p>}
    </div>
  </div>;
}

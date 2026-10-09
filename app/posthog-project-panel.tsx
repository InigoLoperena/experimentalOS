"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, BarChart3, RefreshCw, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Item } from "@/lib/model";
import { syncPosthogExperiments, posthogId as idOf, posthogName as nameOf, posthogMetric as metricOf, posthogStatus as statusOf } from "@/lib/posthog-sync";
import { posthogHost } from "@/lib/posthog-api";
import { cleanupAttachments } from "@/lib/attachment-service";

type Props = {
  project: Item;
  experiments: Item[];
  workspaceId: string;
  userId: string | null;
  editable: boolean;
  onSynced: () => Promise<void> | void;
};

type PHExperiment = Record<string, any>;

function listFrom(payload: any): PHExperiment[] {
  const value = payload?.experiments;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(payload?.results)) return payload.results;
  throw new Error("PostHog no devolvió una lista válida. No se sincronizaron datos.");
}

export function PostHogProjectPanel({ project, experiments, workspaceId, userId, editable, onSynced }: Props) {
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<PHExperiment[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const projectId = String(project.fields.posthog_project_id || "").trim();
  let host = "";
  try { host = posthogHost(String(project.fields.posthog_host || ""), String(project.fields.posthog_host || "").replace(/^https:\/\//, "").replace(/\/+$/, "")); } catch {}
  const localByRemote = useMemo(() => new Map(experiments.map(e => [String(e.fields.posthog_experiment_id || ""), e])), [experiments]);
  const experimentsRef = useRef(experiments);
  useEffect(() => { experimentsRef.current = experiments; }, [experiments]);
  const inFlight = useRef(false);

  async function fetchPostHog(sync = true) {
    if (!supabase || !projectId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Inicia sesión de nuevo para consultar PostHog.");
      const response = await fetch("/api/posthog", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: project.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se ha podido consultar PostHog.");
      const list = listFrom(payload);
      setRemote(list);
      if (sync && editable && userId) {
        let counts;
        try { counts = await syncPosthogExperiments(supabase, project, userId, experimentsRef.current, list); }
        finally { await onSynced(); }
        const { created, updated, removed } = counts;
        void cleanupAttachments().catch(() => {});
        const changes = [
          created ? `${created} importado${created === 1 ? "" : "s"}` : "",
          updated ? `${updated} actualizado${updated === 1 ? "" : "s"}` : "",
          removed ? `${removed} eliminado${removed === 1 ? "" : "s"} porque ya no existe${removed === 1 ? "" : "n"} en PostHog` : "",
        ].filter(Boolean);
        setMessage(changes.length ? `Sincronización completada: ${changes.join(", ")}.` : "Experimental OS está sincronizado con PostHog.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al consultar PostHog.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  const fetchRef = useRef(fetchPostHog);
  useEffect(() => { fetchRef.current = fetchPostHog; });

  useEffect(() => {
    if (!open || !projectId) return;
    void fetchRef.current(true);
    const timer = window.setInterval(() => void fetchRef.current(true), 60000);
    return () => window.clearInterval(timer);
  }, [open, project.id, projectId, host]);

  return <>
    <button className="btn posthog-project-button" type="button" onClick={() => setOpen(true)}>
      <BarChart3 size={16}/> PostHog
    </button>
    {open && <div className="posthog-project-overlay" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section className="posthog-project-modal">
        <div className="posthog-project-title">
          <div><span className="eyebrow">POSTHOG</span><h2>{project.title}</h2><p>Experimentos y datos conectados con Experimental OS.</p></div>
          <button className="icon-button" onClick={() => setOpen(false)} aria-label="Cerrar"><X/></button>
        </div>
        {!projectId ? <div className="notice">Edita el proyecto y añade primero su ID de proyecto de PostHog y el host.</div> : <>
          <div className="row">
            <button className="btn primary" onClick={() => void fetchPostHog(true)} disabled={busy}>
              <RefreshCw size={15} className={busy ? "spin" : ""}/> {busy ? "Sincronizando…" : "Actualizar y sincronizar"}
            </button>
            {host && <a className="project-link" href={`${host}/project/${encodeURIComponent(projectId)}/experiments`} target="_blank" rel="noreferrer">Abrir PostHog <ArrowUpRight size={14}/></a>}
          </div>
          {message && <p className="small">{message}</p>}
          <div className="posthog-project-stats">
            <div><span>Experimentos en PostHog</span><strong>{remote.length}</strong></div>
            <div><span>Vinculados en Experimental OS</span><strong>{remote.filter(e => localByRemote.has(idOf(e))).length}</strong></div>
          </div>
          <div className="posthog-experiment-list">
            {remote.map(ph => {
              const id=idOf(ph), local=localByRemote.get(id);
              return <article key={id || nameOf(ph)}>
                <div><span className="eyebrow">{statusOf(ph)}</span><h3>{nameOf(ph)}</h3><p>{metricOf(ph) || "Métricas disponibles en PostHog"}</p></div>
                <div className="posthog-sync-state">{local ? "✓ Vinculado" : editable ? "Importando…" : "No vinculado"}</div>
                {id && host && <a href={`${host}/project/${encodeURIComponent(projectId)}/experiments/${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">Ver experimento <ArrowUpRight size={13}/></a>}
              </article>;
            })}
            {!busy && !remote.length && <p className="small">No hay experimentos disponibles o todavía no se han cargado.</p>}
          </div>
          <p className="small">Mientras esta ventana esté abierta, Experimental OS comprueba PostHog cada minuto. También se sincroniza al abrirla o pulsar actualizar.</p>
        </>}
      </section>
    </div>}
  </>;
}

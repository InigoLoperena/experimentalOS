"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, RefreshCw, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Item } from "@/lib/model";

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
  return [];
}
function idOf(e: PHExperiment) {
  return String(e.id ?? e.pk ?? e.uuid ?? "").trim();
}
function nameOf(e: PHExperiment) {
  return String(e.name ?? e.title ?? e.feature_flag?.name ?? "Experimento de PostHog");
}
function statusOf(e: PHExperiment) {
  if (e.archived) return "Archivado";
  if (e.end_date) return "Finalizado";
  if (e.start_date) return "En curso";
  return String(e.status ?? e.state ?? "Borrador");
}
function metricOf(e: PHExperiment) {
  const metric = e.metrics?.[0] ?? e.primary_metrics?.[0] ?? e.parameters?.feature_flag_variants?.[0];
  return String(metric?.name ?? metric?.metric_name ?? metric?.event ?? e.description ?? "");
}

export function PostHogProjectPanel({ project, experiments, workspaceId, userId, editable, onSynced }: Props) {
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<PHExperiment[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const projectId = String(project.fields.posthog_project_id || "").trim();
  const host = String(project.fields.posthog_host || "https://us.posthog.com").replace(/\/+$/, "");
  const localByRemote = useMemo(() => new Map(experiments.map(e => [String(e.fields.posthog_experiment_id || ""), e])), [experiments]);

  async function fetchPostHog(sync = true) {
    if (!supabase || !projectId) return;
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
      if (sync && editable && list.length) {
        let created = 0, updated = 0;
        for (const ph of list) {
          const externalId = idOf(ph);
          if (!externalId) continue;
          const existing = localByRemote.get(externalId);
          const nextFields = {
            ...(existing?.fields || {}),
            posthog_experiment_id: externalId,
            metric: existing?.fields.metric || metricOf(ph),
            context: existing?.fields.context || String(ph.description || ""),
            status: statusOf(ph),
          };
          if (existing) {
            const r = await supabase.from("records").update({
              title: nameOf(ph), fields: nextFields, updated_by: userId,
            }).eq("id", existing.id);
            if (r.error) throw r.error;
            updated++;
          } else {
            const r = await supabase.from("records").insert({
              id: crypto.randomUUID(), workspace_id: workspaceId, project_id: project.id,
              kind: "experiment", parent_id: null, related_id: null, title: nameOf(ph),
              owner_id: userId, fields: { ...nextFields, impact: 5, confidence: 5, ease: 5 },
              created_by: userId, updated_by: userId,
            });
            if (r.error) throw r.error;
            created++;
          }
        }
        await onSynced();
        setMessage(created ? `${created} experimento${created === 1 ? "" : "s"} importado${created === 1 ? "" : "s"} de PostHog.` : "Experimental OS está sincronizado con PostHog.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al consultar PostHog.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (!open || !projectId) return;
    void fetchPostHog(true);
    const timer = window.setInterval(() => void fetchPostHog(true), 60000);
    return () => window.clearInterval(timer);
  }, [open, project.id, projectId]);

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
            <a className="project-link" href={`${host}/project/${projectId}/experiments`} target="_blank" rel="noreferrer">Abrir PostHog <ArrowUpRight size={14}/></a>
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
                {id && <a href={`${host}/project/${projectId}/experiments/${id}`} target="_blank" rel="noreferrer">Ver experimento <ArrowUpRight size={13}/></a>}
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

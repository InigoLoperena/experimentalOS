"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Item } from "@/lib/model";

type Props = {
  experiment: Item;
  project: Item | null;
};

type ResultPayload = {
  host?: string;
  project_id?: string;
  detail?: Record<string, any>;
  results?: any;
  results_error?: string | null;
  updated_at?: string;
  error?: string;
};

function valueAt(obj: any, paths: string[][]) {
  for (const path of paths) {
    let value = obj;
    for (const key of path) value = value?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function numberText(value: any) {
  if (value === undefined || value === null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("es").format(number) : String(value);
}

function statusText(detail: any) {
  return String(
    valueAt(detail, [
      ["status"],
      ["state"],
      ["experiment_status"],
      ["start_date"],
    ]) || "Disponible en PostHog",
  );
}

function collectVariants(results: any) {
  const candidates = [
    results?.variants,
    results?.variant_results,
    results?.results,
    results?.metrics?.[0]?.variants,
    results?.primary_metrics?.[0]?.variants,
  ];
  const source = candidates.find((item) => Array.isArray(item));
  if (!source) return [];
  return source.slice(0, 8).map((item: any, index: number) => ({
    name: String(item?.key || item?.name || item?.variant || item?.label || `Variante ${index + 1}`),
    value: valueAt(item, [
      ["conversion_rate"],
      ["conversionRate"],
      ["value"],
      ["count"],
      ["mean"],
    ]),
    exposures: valueAt(item, [["exposures"], ["sample_size"], ["sampleSize"], ["participants"], ["count"]]),
  }));
}

export function PostHogResults({ experiment, project }: Props) {
  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const experimentId = String(experiment.fields.posthog_experiment_id || "").trim();
  const posthogProjectId = String(project?.fields.posthog_project_id || "").trim();
  const configured = !!experimentId && !!posthogProjectId;
  const variants = useMemo(() => collectVariants(payload?.results), [payload]);
  const requestVersion = useRef(0);
  const inFlight = useRef(false);

  async function refresh() {
    if (!configured || !supabase || inFlight.current) return;
    const version = ++requestVersion.current;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Inicia sesión de nuevo para consultar PostHog.");
      const response = await fetch("/api/posthog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          project_id: project?.id,
          experiment_id: experimentId,
        }),
      });
      const next = (await response.json()) as ResultPayload;
      if (!response.ok) throw new Error(next.error || "No se ha podido consultar PostHog.");
      if (version === requestVersion.current) setPayload(next);
    } catch (err) {
      if (version === requestVersion.current) setError(err instanceof Error ? err.message : "No se ha podido consultar PostHog.");
    } finally {
      if (version === requestVersion.current) { inFlight.current = false; setBusy(false); }
    }
  }

  useEffect(() => {
    ++requestVersion.current;
    inFlight.current = false;
    setPayload(null);
    setError("");
    setBusy(false);
    return () => { ++requestVersion.current; inFlight.current = false; };
  }, [experiment.id, experimentId, project?.id, posthogProjectId]);

  if (!project) return null;

  const detail = payload?.detail || {};
  const posthogUrl =
    payload?.host && payload?.project_id && experimentId
      ? `${payload.host}/project/${encodeURIComponent(payload.project_id)}/experiments/${encodeURIComponent(experimentId)}`
      : "";

  return (
    <section className="posthog-live">
      <div className="posthog-live-head">
        <div>
          <span className="eyebrow">POSTHOG</span>
          <h3>Resultados en vivo</h3>
        </div>
        {configured && (
          <button className="btn" type="button" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw size={15} className={busy ? "spin" : ""} />
            {busy ? "Actualizando…" : payload ? "Actualizar datos" : "Cargar datos"}
          </button>
        )}
      </div>

      {!posthogProjectId && (
        <p className="small">
          Configura el <strong>ID del proyecto de PostHog</strong> en la ficha de {project.title}.
        </p>
      )}
      {posthogProjectId && !experimentId && (
        <p className="small">
          Edita este experimento y añade su <strong>ID del experimento en PostHog</strong>.
        </p>
      )}
      {error && <div className="error">{error}</div>}

      {payload && (
        <>
          <div className="posthog-summary">
            <div><span>Estado</span><strong>{statusText(detail)}</strong></div>
            <div><span>Exposiciones</span><strong>{numberText(valueAt(payload.results, [["total_exposures"], ["exposures"], ["sample_size"], ["sampleSize"]]))}</strong></div>
            <div><span>Experimento</span><strong>{String(detail.name || detail.title || experiment.title)}</strong></div>
          </div>

          {variants.length > 0 && (
            <div className="posthog-variants">
              {variants.map((variant) => (
                <div key={variant.name} className="posthog-variant">
                  <strong>{variant.name}</strong>
                  <span>{numberText(variant.value)}</span>
                  <small>{variant.exposures !== undefined ? `${numberText(variant.exposures)} exposiciones` : "Resultado actual"}</small>
                </div>
              ))}
            </div>
          )}

          {payload.results_error && <p className="small">{payload.results_error}</p>}
          <div className="posthog-live-foot">
            <span className="small">
              Última consulta: {payload.updated_at ? new Date(payload.updated_at).toLocaleString("es") : "ahora"}
            </span>
            {posthogUrl && (
              <a href={posthogUrl} target="_blank" rel="noreferrer">
                Abrir en PostHog <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        </>
      )}
    </section>
  );
}

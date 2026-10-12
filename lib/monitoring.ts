import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "./model";
import { readAllPages } from "./backup-service";

export const providers = { meta_ads: "Meta Ads", google_ads: "Google Ads", posthog: "PostHog", metricool: "Metricool",
  smartlead: "Smartlead", linkedin_ads: "LinkedIn Ads", tiktok_ads: "TikTok Ads", other: "Otra plataforma" } as const;
export type Provider = keyof typeof providers;
export function channelProvider(channel:unknown):Provider{
  if(typeof channel==='string'&&Object.hasOwn(providers,channel))return channel as Provider;
  if(['web_app','mobile_ios','mobile_android'].includes(String(channel)))return 'posthog';
  return 'other';
}
export type Scope = { workspace_id: string; project_id: string; experiment_id: string };
export type ExperimentSpec = Scope & { code: string; status: string; budget: number | null; currency: string;
  budget_period: "daily" | "total"; planned_start: string | null; planned_end: string | null; timezone: string; updated_at: string };
export type Variant = Scope & { id: string; label: string; description: string; is_control: boolean; allocation: number | null; updated_at: string };
export type ExternalResource = Scope & { id: string; variant_id: string | null; provider: Provider; resource_type: string;
  external_id: string | null; external_url: string | null; label: string; observed_status: string; updated_at: string };
export type Observation = Scope & { id: string; resource_id: string; metric: string; unit: "count" | "currency" | "ratio" | "number";
  currency: string | null; value: number; period_start: string; period_end: string; source: "manual" | "csv" | "api"; notes: string; updated_at: string };
export type Monitoring = { spec: ExperimentSpec; variants: Variant[]; resources: ExternalResource[]; observations: Observation[] };

export function experimentScope(experiment: Item): Scope {
  if (experiment.kind !== "experiment" || !experiment.project_id) throw new Error("Selecciona un experimento de un proyecto.");
  return { workspace_id: experiment.workspace_id, project_id: experiment.project_id, experiment_id: experiment.id };
}

export function scoped(client: SupabaseClient, table: string, scope: Scope) {
  return client.from(table).select("*", { count: "exact" }).eq("workspace_id", scope.workspace_id)
    .eq("project_id", scope.project_id).eq("experiment_id", scope.experiment_id);
}

export async function loadMonitoring(client: SupabaseClient, experiment: Item): Promise<Monitoring> {
  const scope = experimentScope(experiment);
  const list = <T>(table: string) => readAllPages<T>((from, to) => scoped(client, table, scope).order("created_at").order("id").range(from, to));
  const [specResult, variants, resources, observations] = await Promise.all([
    scoped(client, "experiment_specs", scope).single(), list<Variant>("experiment_variants"),
    list<ExternalResource>("external_resources"), list<Observation>("metric_observations"),
  ]);
  if (specResult.error || !specResult.data) throw new Error("No se pudo cargar la preparación del experimento. Actualiza los datos o revisa su acceso.");
  return { spec: specResult.data as ExperimentSpec, variants, resources, observations };
}

export function safeResourceUrl(value: string): string | null {
  if (!value.trim()) return null;
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Introduce una URL HTTPS válida."); }
  if (url.protocol !== "https:" || url.username || url.password || value.length > 2000) throw new Error("Introduce una URL HTTPS sin credenciales.");
  return url.href;
}

export function validateObservation(input: Pick<Observation, "metric" | "unit" | "value" | "currency" | "period_start" | "period_end">) {
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(input.metric)) throw new Error("La métrica debe usar letras minúsculas, números y guiones bajos.");
  if (!["count","currency","ratio","number"].includes(input.unit)) throw new Error("Selecciona una unidad válida.");
  if (!Number.isFinite(input.value) || input.value < 0 || input.value >= 1e12) throw new Error("Introduce un valor numérico válido, sin valores negativos.");
  if (input.unit === "ratio" && input.value > 1) throw new Error("Las proporciones se guardan entre 0 y 1; por ejemplo 0.05 para un 5 %.");
  if (input.unit === "count" && !Number.isInteger(input.value)) throw new Error("Los recuentos deben ser enteros.");
  const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!date(input.period_start) || !date(input.period_end) || input.period_end < input.period_start) throw new Error("Revisa las fechas del periodo.");
  if (input.unit === "currency" ? !/^[A-Z]{3}$/.test(input.currency || "") : input.currency !== null) throw new Error("Revisa la moneda y la unidad.");
}

// Never aggregate overlapping periods, cumulative snapshots, ratios or currencies.
// The UI displays comparable observations for one explicit period instead.
export function periodRows(observations: Observation[], start: string, end: string) {
  return observations.filter(row => row.period_start === start && row.period_end === end);
}

export const metricLabels: Record<string,string> = { impressions: "Impresiones", clicks: "Clics", spend: "Gasto",
  conversions: "Conversiones", reach: "Alcance", open_google_maps: "Clics en abrir Google Maps" };

export function metricTitle(metric:string,notes=''){
  if(metricLabels[metric])return metric==='clicks'&&notes.includes('Meta')?'Clics (todos)':metricLabels[metric];
  const key=/^(action|value|video25|video50|video75|video100)_(.+)_[a-f0-9]{8}$/.exec(metric);
  if(!key)return metric;
  const action=/Meta \w+ · ([a-zA-Z0-9_.-]+);/.exec(notes)?.[1]||key[2];
  if(key[1].startsWith('video'))return `Vídeo visto al ${key[1].slice(5)}%`;
  const names:Record<string,string>={link_click:'Clics en enlace',landing_page_view:'Visitas a la página de destino',post_engagement:'Interacciones con anuncios',page_engagement:'Interacciones con la página',video_view:'Visualizaciones de vídeo',lead:'Leads',purchase:'Compras',complete_registration:'Registros completos'};
  const label=names[action]||`Evento Meta: ${action}`;
  return key[1]==='value'?`Valor · ${label}`:label;
}

export type CsvMetric = { external_id: string; metric: string; unit: Observation["unit"]; currency: string | null;
  value: number; period_start: string; period_end: string; notes: string };

export const metricsCsvTemplate = "external_id,metric,value,unit,currency,period_start,period_end,notes\n123456,clicks,120,count,,2026-10-01,2026-10-07,\n123456,spend,70,currency,USD,2026-10-01,2026-10-07,\n";

export function parseMetricsCsv(text: string): CsvMetric[] {
  if (text.length > 500000) throw new Error("El CSV debe ocupar menos de 500 KB.");
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i=0; i<=text.length; i++) {
    const char = text[i] ?? "\n";
    if (quoted) {
      if (char === '"') { if (text[i+1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else { if (i===text.length) throw new Error("El CSV contiene comillas sin cerrar."); field += char; }
    } else if (char === ',' || char === '\n') {
      row.push(field); field = ""; closed = false;
      if (char === '\n') { if (row.some(cell => cell.trim())) rows.push(row); row=[]; }
    } else if (char === '"' && field === "" && !closed) quoted = true;
    else { if (closed || char === '"') throw new Error("El CSV contiene una celda mal formada."); field += char; }
  }
  const expected = ["external_id","metric","value","unit","currency","period_start","period_end","notes"];
  if (!rows.length || rows[0].join(",") !== expected.join(",")) throw new Error("Utiliza las columnas de la plantilla CSV.");
  if (rows.length > 501) throw new Error("Importa como máximo 500 filas por archivo.");
  const keys = new Set<string>();
  return rows.slice(1).map((cells, index) => {
    if (cells.length !== expected.length || !cells[0].trim() || !cells[2].trim()) throw new Error(`Revisa la fila ${index+2} del CSV.`);
    const result: CsvMetric = { external_id: cells[0].trim(), metric: cells[1].trim(), value: Number(cells[2]),
      unit: cells[3].trim() as Observation["unit"], currency: cells[4].trim() || null,
      period_start: cells[5].trim(), period_end: cells[6].trim(), notes: cells[7] };
    validateObservation(result);
    if (result.notes.length>2000) throw new Error(`La nota de la fila ${index+2} es demasiado larga.`);
    const key=JSON.stringify([result.external_id,result.metric,result.period_start,result.period_end]);
    if (keys.has(key)) throw new Error(`La fila ${index+2} repite una métrica del mismo periodo.`);
    keys.add(key); return result;
  });
}

export function csvObservationPayload(experiment: Item, resources: ExternalResource[], rows: CsvMetric[]) {
  const scope = experimentScope(experiment);
  return rows.map(({ external_id,...row }) => {
    const matches = resources.filter(resource => resource.external_id === external_id && resource.experiment_id === experiment.id && resource.workspace_id === experiment.workspace_id);
    if (matches.length !== 1) throw new Error(`El ID ${external_id} debe identificar exactamente un recurso vinculado a este experimento.`);
    return { ...scope, ...row, resource_id: matches[0].id, source: "csv" as const };
  });
}

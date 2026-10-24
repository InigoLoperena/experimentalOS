import type { Fields, Item } from "./model";

export const experimentFields: {
  key: string;
  label: string;
  type?: "textarea" | "date" | "number" | "select";
  options?: string[];
}[] = [
  // Single shared schema used by Growth Tree and MVPs Tree.
  // Keep both the original Growth fields and legacy MVP fields editable.
  { key: "context", label: "Contexto", type: "textarea" },
  { key: "description", label: "Descripción", type: "textarea" },
  { key: "hypothesis", label: "Hipótesis", type: "textarea" },
  { key: "audience", label: "Target" },
  { key: "metric", label: "Métrica principal" },
  { key: "success_criteria", label: "Criterio de éxito", type: "textarea" },
  { key: "secondary_metrics", label: "Métricas secundarias", type: "textarea" },
  { key: "traffic_plan", label: "Audiencia y asignación de tráfico", type: "textarea" },
  { key: "risks", label: "Riesgos", type: "textarea" },
  { key: "start", label: "Fecha de inicio", type: "date" },
  { key: "end", label: "Fecha de finalización", type: "date" },
  { key: "result", label: "Resultados obtenidos", type: "textarea" },
  { key: "learning", label: "Aprendizaje", type: "textarea" },
  { key: "decision", label: "Decisión", type: "select", options: ["", "Continuar", "Iterar", "Escalar", "Descartar", "Investigar más", "Inconcluso"] },
  { key: "tags", label: "Etiquetas (separadas por comas)" },
  { key: "posthog_experiment_id", label: "ID del experimento en PostHog" },
  { key: "impact", label: "Impacto (1–10)", type: "number" },
  { key: "confidence", label: "Confianza (1–10)", type: "number" },
  { key: "ease", label: "Facilidad (1–10)", type: "number" },
];
const iceKeys = new Set(["impact", "confidence", "ease"]);
// Keep the full schema above for existing records, AI/provider preparation and
// exports. The shared editor presents only the fields currently requested.
const editorKeys = new Set(["context", "description", "audience", "metric", "success_criteria"]);
export const experimentEditorFields = experimentFields.filter(field => editorKeys.has(field.key));
const legacyKeys = ["secondary_metrics", "audience", "traffic_plan", "risks",
  "description", "end", "result", "learning", "decision", "mvp_hypothesis_id"];
export const experimentSections = {
  primary: experimentFields.filter(f => !iceKeys.has(f.key) && f.key !== "posthog_experiment_id"),
  ice: experimentFields.filter(f => iceKeys.has(f.key)),
  additional: [],
};

// El nombre y el responsable se guardan en title y owner_id, respectivamente.
export function cleanExperimentFields(fields: Fields): Fields {
  return Object.fromEntries(
    [...experimentFields.map(({key})=>key),...legacyKeys,'channel','execution_config']
      .filter(key => fields[key] !== undefined)
      .map(key => [key, fields[key]]),
  );
}

export function normalizeExperiment(item: Item): Item {
  return item.kind === "experiment"
    ? { ...item, fields: cleanExperimentFields(item.fields) }
    : item;
}

import type { Fields, Item } from "./model";

export const experimentFields: {
  key: string;
  label: string;
  type?: "textarea" | "date" | "number";
}[] = [
  { key: "context", label: "Contexto", type: "textarea" },
  { key: "hypothesis", label: "Hipótesis", type: "textarea" },
  { key: "metric", label: "Métrica principal" },
  { key: "success_criteria", label: "Criterio de éxito", type: "textarea" },
  { key: "start", label: "Fecha de inicio", type: "date" },
  { key: "tags", label: "Etiquetas (separadas por comas)" },
  { key: "posthog_experiment_id", label: "ID del experimento en PostHog" },
  { key: "impact", label: "Impacto (1–10)", type: "number" },
  { key: "confidence", label: "Confianza (1–10)", type: "number" },
  { key: "ease", label: "Facilidad (1–10)", type: "number" },

];
const iceKeys = new Set(["impact", "confidence", "ease"]);
const legacyKeys = ["secondary_metrics", "audience", "traffic_plan", "risks"];
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

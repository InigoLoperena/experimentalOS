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
  {
    key: "secondary_metrics",
    label: "Métricas secundarias que pueden verse afectadas",
    type: "textarea",
  },
  { key: "audience", label: "Audiencia", type: "textarea" },
  { key: "traffic_plan", label: "Asignación de tráfico", type: "textarea" },
  { key: "risks", label: "Riesgos", type: "textarea" },
  { key: "start", label: "Fecha de inicio", type: "date" },
  { key: "impact", label: "Impacto (1–10)", type: "number" },
  { key: "confidence", label: "Confianza (1–10)", type: "number" },
  { key: "ease", label: "Facilidad (1–10)", type: "number" },
  { key: "tags", label: "Etiquetas (separadas por comas)" },
];

// Name and champion live in the record's title and owner_id, respectively.
export function cleanExperimentFields(fields: Fields): Fields {
  return Object.fromEntries(
    experimentFields
      .filter(({ key }) => fields[key] !== undefined)
      .map(({ key }) => [key, fields[key]]),
  );
}

export function normalizeExperiment(item: Item): Item {
  return item.kind === "experiment"
    ? { ...item, fields: cleanExperimentFields(item.fields) }
    : item;
}

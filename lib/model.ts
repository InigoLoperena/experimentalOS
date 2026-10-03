import { variantError } from "./variants";
export type Kind =
  | "north_star"
  | "goal"
  | "opportunity"
  | "idea"
  | "experiment"
  | "objective"
  | "kr"
  | "project";
export type Fields = Record<string, string | number | boolean | undefined>;
export type Item = {
  id: string;
  workspace_id: string;
  kind: Kind;
  parent_id: string | null;
  related_id: string | null;
  title: string;
  owner_id: string | null;
  fields: Fields;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  created_by_name?: string;
  updated_by_name?: string;
};
export type Member = {
  user_id: string;
  role: "owner" | "editor" | "viewer";
  name: string;
};
export type Activity = {
  id: string;
  actor_id: string | null;
  actor_name?: string;
  action: string;
  record_id: string | null;
  title: string;
  created_at: string;
};
export const kinds: Record<Kind, string> = {
  north_star: "North Star",
  goal: "Goal",
  opportunity: "Oportunidad",
  idea: "Idea",
  experiment: "Experimento",
  objective: "Objetivo OKR",
  kr: "Key Result",
  project: "Proyecto",
};
export const parents: Record<Kind, Kind | null> = {
  north_star: null,
  goal: "north_star",
  opportunity: "goal",
  idea: "opportunity",
  experiment: "idea",
  objective: null,
  kr: "objective",
  project: null,
};
export const states = [
  "Backlog",
  "Diseñado",
  "En curso",
  "En análisis",
  "Finalizado",
  "Archivado",
];
export const channels = [
  "Producto / Web",
  "App móvil",
  "Meta Ads",
  "Google Ads",
  "Email",
  "SEO",
  "Ventas",
  "Otro",
];
export function score(f: Fields) {
  return (
    Number(f.impact || 0) * Number(f.confidence || 0) * Number(f.ease || 0)
  );
}
export function progress(f: Fields) {
  const b = Number(f.baseline || 0),
    t = Number(f.target || 0),
    c = Number(f.current || 0);
  return t === b
    ? 0
    : Math.max(0, Math.min(100, Math.round(((c - b) / (t - b)) * 100)));
}
export function validate(
  item: Pick<Item, "kind" | "title" | "parent_id" | "fields">,
): string | null {
  if (!item.title.trim()) return "Escribe un nombre.";
  if (parents[item.kind] && !item.parent_id)
    return "Selecciona el elemento padre.";
  const f = item.fields;
  if (item.kind === "experiment") {
    const err = variantError(f);
    if (err) return err;
  }
  for (const k of ["impact", "confidence", "ease"])
    if (
      f[k] !== undefined &&
      (!Number.isInteger(Number(f[k])) || Number(f[k]) < 1 || Number(f[k]) > 10)
    )
      return "Las puntuaciones ICE deben ser enteros entre 1 y 10.";
  if (f.start && f.end && String(f.end) < String(f.start))
    return "La fecha final debe ser posterior al inicio.";
  for (const k of [
    "cost",
    "sample_target",
    "control_n",
    "control_success",
    "variant_n",
    "variant_success",
  ])
    if (f[k] !== undefined && Number(f[k]) < 0)
      return "Los costes y las muestras no pueden ser negativos.";
  if (
    item.kind === "experiment" &&
    ["En curso", "En análisis", "Finalizado"].includes(String(f.status))
  ) {
    for (const k of [
      "hypothesis",
      "metric",
      "success_criteria",
      "method",
      "start",
      "end",
    ])
      if (!String(f[k] || "").trim())
        return "Antes de lanzar, completa hipótesis, métrica, criterio de éxito, método y fechas.";
    if (f.baseline === undefined || f.target === undefined)
      return "Define el valor inicial y el objetivo antes de lanzar.";
  }
  if (
    item.kind === "experiment" &&
    f.status === "Finalizado" &&
    (!f.conclusion || !f.learning || !f.decision || !f.result)
  )
    return "Para finalizar, documenta resultado, conclusión, aprendizaje y decisión.";
  if (
    f.control_success !== undefined &&
    Number(f.control_success) > Number(f.control_n || 0)
  )
    return "Las conversiones A no pueden superar la muestra A.";
  if (
    f.variant_success !== undefined &&
    Number(f.variant_success) > Number(f.variant_n || 0)
  )
    return "Las conversiones B no pueden superar la muestra B.";
  return null;
}
export function rates(f: Fields) {
  const a = Number(f.control_n || 0),
    b = Number(f.variant_n || 0);
  if (!a || !b) return null;
  const ra = Number(f.control_success || 0) / a,
    rb = Number(f.variant_success || 0) / b;
  return { a: ra * 100, b: rb * 100, lift: ra ? (rb / ra - 1) * 100 : null };
}
export function ancestors(item: Item, items: Item[]): Item[] {
  const list: Item[] = [];
  let n: Item | undefined = item;
  const seen = new Set<string>();
  while (n && !seen.has(n.id)) {
    seen.add(n.id);
    list.unshift(n);
    n = items.find((x) => x.id === n?.parent_id);
  }
  return list;
}

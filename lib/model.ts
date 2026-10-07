import { cleanExperimentFields } from "./experiments";
export type Kind =
  | "north_star"
  | "goal"
  | "opportunity"
  | "idea"
  | "experiment"
  | "learning"
  | "objective"
  | "kr"
  | "project";
export type Fields = Record<string, string | number | boolean | undefined>;
export type Item = {
  id: string;
  workspace_id: string;
  project_id: string | null;
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
  avatar_url?: string | null;
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
  goal: "Objetivo",
  opportunity: "Oportunidad",
  idea: "Idea",
  experiment: "Experimento",
  learning: "Aprendizaje",
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
  learning: "experiment",
  objective: null,
  kr: "objective",
  project: null,
};
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
  if (
    !["experiment", "learning"].includes(item.kind) &&
    parents[item.kind] &&
    !item.parent_id
  )
    return "Selecciona el elemento padre.";
  const f =
    item.kind === "experiment"
      ? cleanExperimentFields(item.fields)
      : item.fields;
  for (const k of ["impact", "confidence", "ease"])
    if (
      f[k] !== undefined &&
      (!Number.isInteger(Number(f[k])) || Number(f[k]) < 1 || Number(f[k]) > 10)
    )
      return "Las puntuaciones ICE deben ser enteros entre 1 y 10.";
  if (
    item.kind !== "experiment" &&
    f.start &&
    f.end &&
    String(f.end) < String(f.start)
  )
    return "La fecha final debe ser posterior al inicio.";
  return null;
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

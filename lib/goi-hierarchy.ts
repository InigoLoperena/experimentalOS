import type { Item } from "./model";

export type GoiHierarchyView = "goals" | "input_metrics" | "opportunities" | "ideas";

const VISIBLE_KINDS = new Set<Item["kind"]>(["goal", "opportunity", "idea", "experiment"]);
const byDateThenId = (a: Item, b: Item) =>
  a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/**
 * For every GOI subsection, show its records and all ancestor levels on arrival.
 * The selected records' descendants are available, but start folded.
 * North Star is implicit: it does not appear as an extra hierarchy node.
 */
export function getGoiHierarchy(items: Item[], view: GoiHierarchyView) {
  const target = items.filter(item =>
    view === "goals" ? item.kind === "goal" && item.fields.goi_section !== "input_metrics" :
    view === "input_metrics" ? item.kind === "goal" && item.fields.goi_section === "input_metrics" :
    view === "opportunities" ? item.kind === "opportunity" : item.kind === "idea"
  );
  const byId = new Map(items.map(item => [item.id, item]));
  const childrenIndex = new Map<string, Item[]>();
  for (const item of items) {
    if (!item.parent_id || !VISIBLE_KINDS.has(item.kind)) continue;
    const group = childrenIndex.get(item.parent_id) || [];
    group.push(item);
    childrenIndex.set(item.parent_id, group);
  }

  const included = new Set(target.map(item => item.id));
  const expanded = new Set<string>();

  // Opening all ancestors makes the selected kind visible by default:
  // opportunities => goal + opportunities; ideas => goal + opportunities + ideas.
  for (const selected of target) {
    const seen = new Set<string>([selected.id]);
    let parentId = selected.parent_id;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      if (VISIBLE_KINDS.has(parent.kind)) {
        included.add(parent.id);
        expanded.add(parent.id);
      }
      parentId = parent.parent_id;
    }
  }

  const processed = new Set<string>();
  const includeDescendants = (parentId: string) => {
    if (processed.has(parentId)) return;
    processed.add(parentId);
    for (const child of childrenIndex.get(parentId) || []) {
      included.add(child.id);
      includeDescendants(child.id);
    }
  };
  target.forEach(item => includeDescendants(item.id));

  const children = (parentId: string): Item[] =>
    (childrenIndex.get(parentId) || [])
      .filter(item => included.has(item.id))
      .sort(byDateThenId);

  const roots = items.filter(item =>
    included.has(item.id) && VISIBLE_KINDS.has(item.kind) &&
    (!item.parent_id || !included.has(item.parent_id))
  ).sort(byDateThenId);
  return { target, roots, children, expanded };
}

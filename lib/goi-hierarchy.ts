import type { Item } from "./model";
import { isProblemon } from "./problemon";

export type GoiHierarchyView = "goals" | "input_metrics" | "opportunities" | "ideas";

const VISIBLE_KINDS = new Set<Item["kind"]>(["goal", "opportunity", "hypothesis", "experiment"]);
const byDateThenId = (a: Item, b: Item) =>
  Number(isProblemon(b)) - Number(isProblemon(a)) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/**
 * For every GOI subsection, show its records and all ancestor levels on arrival.
 * The selected records' descendants are available, but start folded.
 * North Star is implicit: it does not appear as an extra hierarchy node.
 */
export function getGoiHierarchy(items: Item[], view: GoiHierarchyView) {
  const target = items.filter(item =>
    view === "goals" ? item.kind === "goal" && item.fields.goi_section !== "input_metrics" :
    view === "input_metrics" ? item.kind === "goal" && item.fields.goi_section === "input_metrics" :
    view === "opportunities" ? item.kind === "opportunity" : item.kind === "hypothesis"
  );
  const byId = new Map(items.map(item => [item.id, item]));
  const validParent = (item: Item, parent: Item | undefined) =>
    !!parent && parent.project_id === item.project_id &&
    (item.kind === "goal" ? parent.kind === "north_star" :
     item.kind === "opportunity" ? parent.kind === "goal" :
     item.kind === "hypothesis" ? parent.kind === "opportunity" :
     item.kind === "experiment" ? parent.kind === "hypothesis" : false);
  // Orphans are independent records, never deleted or hidden with their old parents.
  const orphanProblemRecords = items.filter(item =>
    item.kind === "opportunity" && !isProblemon(item) && !validParent(item, byId.get(item.parent_id || "")));

  const childrenIndex = new Map<string, Item[]>();
  for (const item of items) {
    if (!item.parent_id || !VISIBLE_KINDS.has(item.kind) || !validParent(item, byId.get(item.parent_id))) continue;
    const group = childrenIndex.get(item.parent_id) || [];
    group.push(item);
    childrenIndex.set(item.parent_id, group);
  }

  const included = new Set(target.map(item => item.id));
  // The Hypotheses subsection also surfaces parentless opportunities, even if
  // they have not yet been linked to an idea.
  if (view === "ideas") orphanProblemRecords.forEach(item => included.add(item.id));
  const expanded = new Set<string>();

  // Opening all ancestors makes the selected kind visible by default:
  // opportunities => goal + opportunities; hypotheses => goal + opportunities + ideas.
  for (const selected of target) {
    const seen = new Set<string>([selected.id]);
    let child = selected;
    while (child.parent_id && !seen.has(child.parent_id)) {
      const parent = byId.get(child.parent_id);
      if (!validParent(child, parent) || !parent) break;
      seen.add(parent.id);
      if (VISIBLE_KINDS.has(parent.kind)) {
        included.add(parent.id);
        expanded.add(parent.id);
      }
      child = parent;
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

  const allRoots = items.filter(item =>
    included.has(item.id) && VISIBLE_KINDS.has(item.kind) &&
    (!item.parent_id || !included.has(item.parent_id) || !validParent(item, byId.get(item.parent_id)))
  ).sort(byDateThenId);
  // Remove the classified orphans from the main list: a record is rendered
  // in its orphan section OR the standard hierarchy, never in both.
  const orphanOpportunities = (view === "opportunities" || view === "ideas")
    ? allRoots.filter(item => item.kind === "opportunity" && !isProblemon(item) && !validParent(item, byId.get(item.parent_id || "")))
    : [];
  const orphanHypotheses = view === "ideas"
    ? allRoots.filter(item => item.kind === "hypothesis" && !validParent(item, byId.get(item.parent_id || "")))
    : [];
  const orphanIds = new Set([...orphanOpportunities, ...orphanHypotheses].map(item => item.id));
  const roots = allRoots.filter(item => !orphanIds.has(item.id));
  return { target, roots, children, expanded, orphanOpportunities, orphanHypotheses };
}

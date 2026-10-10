import type { Person } from "../types/person";

/**
 * Branch folding for the tree view.
 *
 * A pedigree doubles in width with every generation, so the canvas only shows
 * a slice of it: the focus person, `gens` generations of ancestors above them,
 * and whatever hangs below the visible ancestors. Cards at the edge of that
 * slice carry a chip that unfolds their branch a few generations further.
 *
 * Nothing here writes to the tree: it only decides which people are drawn.
 */

/** Generations revealed above a card when its branch is unfolded by hand. */
const UNFOLD_STEP = 3;

export interface FoldState {
  /** Ancestor generations shown above the focus person; Infinity = everything. */
  gens: number;
  /** People whose ancestors were unfolded by hand. */
  expanded: ReadonlySet<string>;
  /** People whose ancestors were folded by hand. */
  collapsed: ReadonlySet<string>;
  /** People forced visible (path to someone selected from outside the canvas). */
  pinned: ReadonlySet<string>;
}

export interface FoldResult {
  visible: Set<string>;
  /** For visible people with hidden parents: how many ancestors are hidden. */
  hiddenAncestors: Map<string, number>;
}

export interface FamilyGraph {
  ids: Set<string>;
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  partners: Map<string, string[]>;
}

/** Children are derived from `parentIds`: prod often leaves `childrenIds` empty. */
export function buildFamilyGraph(people: Person[]): FamilyGraph {
  const ids = new Set(people.map((p) => p.id));
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const partners = new Map<string, string[]>();
  for (const p of people) {
    const ps = (p.parentIds ?? []).filter((id) => ids.has(id));
    parents.set(p.id, ps);
    for (const parent of ps) {
      const list = children.get(parent);
      if (list) list.push(p.id);
      else children.set(parent, [p.id]);
    }
    partners.set(
      p.id,
      (p.partnerIds ?? []).filter((id) => id !== p.id && ids.has(id))
    );
  }
  return { ids, parents, children, partners };
}

function countAncestors(graph: FamilyGraph, id: string, skip?: Set<string>): number {
  const seen = new Set<string>();
  const stack = [...(graph.parents.get(id) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const p of graph.parents.get(cur) ?? []) stack.push(p);
  }
  if (!skip) return seen.size;
  let n = 0;
  for (const s of seen) if (!skip.has(s)) n++;
  return n;
}

/** "me" when present, otherwise the childless person with the deepest ancestry. */
export function defaultFocus(graph: FamilyGraph): string | null {
  if (graph.ids.has("me")) return "me";
  let best: string | null = null;
  let bestCount = -1;
  for (const id of graph.ids) {
    if (graph.children.get(id)?.length) continue;
    const n = countAncestors(graph, id);
    if (n > bestCount) {
      best = id;
      bestCount = n;
    }
  }
  return best;
}

/** Generation of everyone tied to `from`: 0 for them, +1 per step up, −1 per step down. */
function generations(graph: FamilyGraph, from: string | null): Map<string, number> {
  const level = new Map<string, number>();
  if (!from || !graph.ids.has(from)) return level;
  level.set(from, 0);
  const queue = [from];
  const steps: [Map<string, string[]>, number][] = [
    [graph.parents, 1],
    [graph.children, -1],
    [graph.partners, 0],
  ];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const [rel, delta] of steps) {
      for (const n of rel.get(id) ?? []) {
        if (!level.has(n)) {
          level.set(n, level.get(id)! + delta);
          queue.push(n);
        }
      }
    }
  }
  return level;
}

export function computeFold(
  graph: FamilyGraph,
  focusId: string | null,
  fold: FoldState
): FoldResult {
  // budget = how many more generations may be climbed from this person. It
  // comes from the person's generation (`gens` minus their level above the
  // focus person) or from a branch unfolded by hand below them (`extra`),
  // which only carries upwards.
  const budget = new Map<string, number>();
  const levels = new Map<string, number>();
  const queue: string[] = [];
  const visit = (id: string, level: number, extra: number) => {
    const b = Math.max(fold.gens - level, extra);
    const prev = budget.get(id);
    if (prev !== undefined && prev >= b) return;
    budget.set(id, b);
    levels.set(id, level);
    queue.push(id);
  };

  if (fold.gens === Infinity) {
    // every person is an ancestor (or self) of some childless person
    for (const id of graph.ids) {
      if (!graph.children.get(id)?.length) visit(id, 0, 0);
    }
  }
  if (focusId && graph.ids.has(focusId)) visit(focusId, 0, 0);
  if (fold.pinned.size > 0) {
    // pinned people sit at their real generation, so they do not unfold
    // anything around them
    const real = generations(graph, focusId);
    for (const id of fold.pinned) {
      if (graph.ids.has(id)) visit(id, real.get(id) ?? 0, 0);
    }
  }

  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    const b = budget.get(id)!;
    const level = levels.get(id)!;
    const up = fold.collapsed.has(id)
      ? 0
      : fold.expanded.has(id)
        ? Math.max(b, UNFOLD_STEP)
        : b;
    if (up > 0) for (const p of graph.parents.get(id) ?? []) visit(p, level + 1, up - 1);
    for (const c of graph.children.get(id) ?? []) visit(c, level - 1, 0);
    for (const q of graph.partners.get(id) ?? []) visit(q, level, 0);
  }

  const visible = new Set(budget.keys());
  const hiddenAncestors = new Map<string, number>();
  for (const id of visible) {
    const ps = graph.parents.get(id) ?? [];
    if (ps.some((p) => !visible.has(p))) {
      hiddenAncestors.set(id, countAncestors(graph, id, visible));
    }
  }
  return { visible, hiddenAncestors };
}

/** People linking `from` to `to` through any family tie, both ends included. */
export function pathBetween(graph: FamilyGraph, from: string | null, to: string): string[] {
  if (!from || !graph.ids.has(from) || !graph.ids.has(to)) return [to];
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length && !prev.has(to); i++) {
    const id = queue[i];
    for (const rel of [graph.parents, graph.children, graph.partners]) {
      for (const n of rel.get(id) ?? []) {
        if (!prev.has(n)) {
          prev.set(n, id);
          queue.push(n);
        }
      }
    }
  }
  if (!prev.has(to)) return [to];
  const path: string[] = [];
  for (let cur: string | null = to; cur; cur = prev.get(cur) ?? null) path.push(cur);
  return path;
}

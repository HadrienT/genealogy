import dagre from "@dagrejs/dagre";
import type { Person, Marriage, PersonReview } from "../types/person";
import { formatTreeBirthPlace } from "./formatTreeBirthPlace";
import { formatMarriagePlace } from "./formatMarriagePlace";
import { formatDate } from "./formatDate";

/**
 * Family-tree layout.
 *
 * The graph is modelled as a DAG of two node kinds:
 *   • "person"  — one card per individual
 *   • "union"   — a small knot representing a set of co-parents
 *
 * Edges: every parent → their union, every union → each child. A couple with
 * no children still gets a union so the two cards are pulled side-by-side.
 *
 * Positioning is delegated to dagre (network-simplex ranking + Brandes/Köpf
 * coordinate assignment), which keeps every generation on a clean horizontal
 * band and minimises edge crossings. Spouses who married in are pulled onto
 * their partner's row automatically because they share a union node.
 *
 * Only the people in `visible` are laid out (see treeFold.ts); the result is
 * plain geometry, drawn by TreeCanvas.
 */

export const NODE_W = 216;
export const NODE_H = 92;
export const NODE_H_PHOTO = 140;
export const UNION_R = 7;
const UNION_W = 20;
const UNION_H = 16;

export interface PersonCard {
  id: string;
  /** top-left corner */
  x: number;
  y: number;
  h: number;
  person: Person;
  name: string;
  maiden?: string;
  lifespan?: string;
  birthPlace?: string;
  gender?: string;
  deceased: boolean;
  review?: PersonReview["status"];
  uncertain?: boolean;
  /** > 0 when this card's ancestors are folded away */
  hiddenAncestors: number;
  /** true when this card's parents are on the canvas (so they can be folded) */
  canFold: boolean;
}

export interface UnionKnot {
  id: string;
  /** centre */
  x: number;
  y: number;
  tag?: string[];
}

/** x1, y1, x2, y2 — from the bottom of the upper node to the top of the lower one */
export type Link = [number, number, number, number];

export interface TreeLayout {
  cards: PersonCard[];
  byId: Map<string, PersonCard>;
  unions: UnionKnot[];
  /** parent → union */
  unionLinks: Link[];
  /** union → child */
  lineageLinks: Link[];
  width: number;
  height: number;
}

interface Union {
  id: string;
  parents: string[];
  children: string[];
  marriage?: Marriage;
}

function displayName(p: Person): string {
  const parts = [p.firstName, p.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : `#${p.id.slice(0, 6)}`;
}

function lifespan(p: Person): string | undefined {
  const b = p.birthDate?.slice(0, 4);
  const d = p.deathDate?.slice(0, 4);
  if (!b && !d) return undefined;
  if (b && d) return `${b} – ${d}`;
  if (b) return `n. ${b}`;
  return `† ${d}`;
}

interface Positions {
  key: string;
  /** node centres, people and unions alike */
  at: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

let lastPositions: Positions | null = null;

/**
 * Runs dagre, which is by far the slow part (about a second for a thousand
 * people). The result only depends on who is linked to whom, so it is kept
 * and reused as long as that does not change: editing a name, a date or a
 * review marker does not move anything.
 */
function positions(
  people: Person[],
  unions: Map<string, Union>,
  nodeHeight: (p: Person) => number
): Positions {
  let key = "";
  for (const p of people) key += `${p.id}:${nodeHeight(p)};`;
  for (const u of unions.values()) key += `${u.id}>${u.children.join(",")};`;
  if (lastPositions?.key === key) return lastPositions;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: 28,
    edgesep: 12,
    ranksep: 48,
    ranker: "network-simplex",
    marginx: 48,
    marginy: 48,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const p of people) {
    g.setNode(p.id, { width: NODE_W, height: nodeHeight(p) });
  }
  for (const u of unions.values()) {
    g.setNode(u.id, { width: UNION_W, height: UNION_H });
    for (const parent of u.parents) g.setEdge(parent, u.id);
    for (const child of u.children) g.setEdge(u.id, child);
  }

  dagre.layout(g);

  const at = new Map<string, { x: number; y: number }>();
  for (const id of g.nodes()) {
    const n = g.node(id);
    at.set(id, { x: n.x, y: n.y });
  }
  const graph = g.graph();
  lastPositions = { key, at, width: graph.width ?? 0, height: graph.height ?? 0 };
  return lastPositions;
}

export function buildTreeLayout(
  allPeople: Person[],
  marriages: Marriage[] = [],
  months?: string[],
  visible?: ReadonlySet<string>,
  hiddenAncestors?: ReadonlyMap<string, number>
): TreeLayout {
  const people = visible ? allPeople.filter((p) => visible.has(p.id)) : allPeople;
  const byId = new Map<string, PersonCard>();
  if (people.length === 0) {
    return { cards: [], byId, unions: [], unionLinks: [], lineageLinks: [], width: 0, height: 0 };
  }

  const ids = new Set(people.map((p) => p.id));
  const exists = (id: string) => ids.has(id);

  // ── Build union nodes ────────────────────────────────────────────
  const unions = new Map<string, Union>();
  const unionFor = (parents: string[]): Union => {
    const key = [...parents].sort().join("|");
    let u = unions.get(key);
    if (!u) {
      u = { id: `union:${key}`, parents: [...parents].sort(), children: [] };
      unions.set(key, u);
    }
    return u;
  };

  // partnerships (even childless ones)
  for (const p of people) {
    for (const q of p.partnerIds ?? []) {
      if (q !== p.id && exists(q)) unionFor([p.id, q]);
    }
  }
  // parent → child links
  for (const c of people) {
    const parents = (c.parentIds ?? []).filter(exists);
    if (parents.length > 0) unionFor(parents).children.push(c.id);
  }
  // attach marriage records to two-parent unions
  const marriageByPair = new Map<string, Marriage>();
  for (const m of marriages) {
    const key = [...m.partnerIds].sort().join("|");
    if (!marriageByPair.has(key)) marriageByPair.set(key, m);
  }
  for (const u of unions.values()) {
    if (u.parents.length === 2) u.marriage = marriageByPair.get(u.parents.join("|"));
  }

  // ── Position with dagre ──────────────────────────────────────────
  const nodeHeight = (p: Person) => (p.photo ? NODE_H_PHOTO : NODE_H);
  const pos = positions(people, unions, nodeHeight);
  const g = { node: (id: string) => pos.at.get(id)! };

  // ── Emit cards ───────────────────────────────────────────────────
  const cards: PersonCard[] = [];
  for (const p of people) {
    const gn = g.node(p.id);
    const h = nodeHeight(p);
    const hidden = hiddenAncestors?.get(p.id) ?? 0;
    const card: PersonCard = {
      id: p.id,
      x: gn.x - NODE_W / 2,
      y: gn.y - h / 2,
      h,
      person: p,
      name: displayName(p),
      maiden: p.maidenName || undefined,
      lifespan: lifespan(p),
      birthPlace: formatTreeBirthPlace(p) || undefined,
      gender: p.gender,
      deceased: !!p.deathDate,
      review: p.review?.status,
      uncertain: p.review?.uncertain,
      hiddenAncestors: hidden,
      canFold: hidden === 0 && (p.parentIds ?? []).some(exists),
    };
    cards.push(card);
    byId.set(p.id, card);
  }

  // ── Emit unions and links ────────────────────────────────────────
  const knots: UnionKnot[] = [];
  const unionLinks: Link[] = [];
  const lineageLinks: Link[] = [];
  for (const u of unions.values()) {
    const gn = g.node(u.id);
    const m = u.marriage;
    const tag = m
      ? [m.date ? `💍 ${formatDate(m.date, months)}` : "", formatMarriagePlace(m) ?? ""].filter(Boolean)
      : [];
    knots.push({ id: u.id, x: gn.x, y: gn.y, tag: tag.length ? tag : undefined });
    for (const parent of u.parents) {
      const c = byId.get(parent)!;
      unionLinks.push([c.x + NODE_W / 2, c.y + c.h, gn.x, gn.y - UNION_R]);
    }
    for (const child of u.children) {
      const c = byId.get(child)!;
      lineageLinks.push([gn.x, gn.y + UNION_R, c.x + NODE_W / 2, c.y]);
    }
  }

  return {
    cards,
    byId,
    unions: knots,
    unionLinks,
    lineageLinks,
    width: pos.width,
    height: pos.height,
  };
}

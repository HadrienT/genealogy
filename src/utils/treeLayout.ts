import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { Person, Marriage } from "../types/person";
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
 */

export const NODE_W = 216;
export const NODE_H = 92;
export const NODE_H_PHOTO = 140;
const UNION_W = 20;
const UNION_H = 16;

export interface PersonNodeData {
  person: Person;
  name: string;
  maiden?: string;
  lifespan?: string;
  birthPlace?: string;
  gender?: string;
  deceased: boolean;
  selected: boolean;
  [key: string]: unknown;
}

export interface UnionNodeData {
  tagDate?: string;
  tagPlace?: string;
  isCouple: boolean;
  [key: string]: unknown;
}

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
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

export function buildTreeLayout(
  people: Person[],
  marriages: Marriage[] = [],
  months?: string[]
): LayoutResult {
  if (people.length === 0) return { nodes: [], edges: [] };

  const byId = new Map(people.map((p) => [p.id, p]));
  const exists = (id: string) => byId.has(id);

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
  for (const u of unions.values()) {
    if (u.parents.length === 2) {
      u.marriage = marriages.find(
        (m) => m.partnerIds.includes(u.parents[0]) && m.partnerIds.includes(u.parents[1])
      );
    }
  }

  // ── Feed dagre ───────────────────────────────────────────────────
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

  const nodeHeight = (p: Person) => (p.photo ? NODE_H_PHOTO : NODE_H);

  for (const p of people) {
    g.setNode(p.id, { width: NODE_W, height: nodeHeight(p) });
  }
  for (const u of unions.values()) {
    g.setNode(u.id, { width: UNION_W, height: UNION_H });
    for (const parent of u.parents) g.setEdge(parent, u.id);
    for (const child of u.children) g.setEdge(u.id, child);
  }

  dagre.layout(g);

  // ── Emit ReactFlow nodes ─────────────────────────────────────────
  const nodes: Node[] = [];

  for (const p of people) {
    const gn = g.node(p.id);
    const h = nodeHeight(p);
    const data: PersonNodeData = {
      person: p,
      name: displayName(p),
      maiden: p.maidenName || undefined,
      lifespan: lifespan(p),
      birthPlace: formatTreeBirthPlace(p) || undefined,
      gender: p.gender,
      deceased: !!p.deathDate,
      selected: false,
    };
    nodes.push({
      id: p.id,
      type: "person",
      position: { x: gn.x - NODE_W / 2, y: gn.y - h / 2 },
      data,
      draggable: true,
    });
  }

  for (const u of unions.values()) {
    const gn = g.node(u.id);
    const m = u.marriage;
    const data: UnionNodeData = {
      isCouple: u.parents.length === 2,
      tagDate: m?.date ? formatDate(m.date, months) : undefined,
      tagPlace: m ? formatMarriagePlace(m) : undefined,
    };
    nodes.push({
      id: u.id,
      type: "union",
      position: { x: gn.x - UNION_W / 2, y: gn.y - UNION_H / 2 },
      data,
      draggable: false,
      selectable: false,
      focusable: false,
    });
  }

  // ── Emit edges ───────────────────────────────────────────────────
  const edges: Edge[] = [];
  for (const u of unions.values()) {
    for (const parent of u.parents) {
      edges.push({
        id: `uin:${parent}:${u.id}`,
        source: parent,
        target: u.id,
        sourceHandle: "b",
        targetHandle: "t",
        type: "smoothstep",
        className: "edge--union",
        pathOptions: { borderRadius: 6 },
      } as Edge);
    }
    for (const child of u.children) {
      edges.push({
        id: `uout:${u.id}:${child}`,
        source: u.id,
        target: child,
        sourceHandle: "b",
        targetHandle: "t",
        type: "smoothstep",
        className: "edge--lineage",
        pathOptions: { borderRadius: 12 },
      } as Edge);
    }
  }

  return { nodes, edges };
}

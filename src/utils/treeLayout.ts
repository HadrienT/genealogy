import type { Person, Marriage } from "../types/person";
import type { Node, Edge } from "@xyflow/react";
import { formatTreeBirthPlace } from "./formatTreeBirthPlace";

/**
 * Build ReactFlow nodes & edges from the flat person list.
 *
 * Layout strategy — bottom-up width allocation with junction nodes:
 *  1. Identify "family units" (a couple + their children).
 *  2. Recursively compute the width each subtree needs.
 *  3. Place children centered under their parents.
 *  4. Partners sit side-by-side as a single unit.
 *  5. A hidden junction node connects parents to children via a clean
 *     T-shaped connector (one vertical drop + horizontal sibling bar).
 */

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

function getDisplayName(p: Person): string {
  const parts: string[] = [];
  if (p.firstName) parts.push(p.firstName);
  if (p.lastName) parts.push(p.lastName);
  return parts.length > 0 ? parts.join(" ") : `ID: ${p.id}`;
}

function getLifespan(p: Person): string {
  const b = p.birthDate?.substring(0, 4) || "?";
  const d = p.deathDate?.substring(0, 4) || "";
  if (b === "?" && !d) return "";
  return `${b} – ${d}`;
}

// ── Constants ───────────────────────────────────
const NODE_W = 200;
const NODE_H = 80;
const H_GAP = 40;
const COUPLE_GAP = 60;
const V_GAP = 140;
const COUPLE_W = NODE_W * 2 + COUPLE_GAP;

interface FamilyUnit {
  personId: string;
  partnerId?: string;
  childUnits: FamilyUnit[];
  width: number;
}

export function buildTreeLayout(people: Person[], marriages?: Marriage[]): LayoutResult {
  if (people.length === 0) return { nodes: [], edges: [] };

  const byId = new Map<string, Person>();
  people.forEach((p) => byId.set(p.id, p));

  const placed = new Set<string>();

  function buildUnit(personId: string): FamilyUnit {
    placed.add(personId);
    const person = byId.get(personId)!;
    let partnerId: string | undefined;

    if (person.partnerIds) {
      for (const pid of person.partnerIds) {
        if (byId.has(pid) && !placed.has(pid)) {
          partnerId = pid;
          placed.add(pid);
          break;
        }
      }
    }

    const childIdSet = new Set<string>();
    person.childrenIds?.forEach((cid) => {
      if (byId.has(cid) && !placed.has(cid)) childIdSet.add(cid);
    });
    if (partnerId) {
      byId.get(partnerId)!.childrenIds?.forEach((cid) => {
        if (byId.has(cid) && !placed.has(cid)) childIdSet.add(cid);
      });
    }

    const childUnits: FamilyUnit[] = [];
    for (const cid of childIdSet) {
      if (!placed.has(cid)) childUnits.push(buildUnit(cid));
    }

    const ownWidth = partnerId ? COUPLE_W : NODE_W;
    const childrenTotalWidth =
      childUnits.length > 0
        ? childUnits.reduce((sum, u) => sum + u.width, 0) +
          (childUnits.length - 1) * H_GAP
        : 0;

    // For a single child who has a partner, the child PERSON is centered
    // under the parents while the partner sits to the right.  This shifts
    // the child couple rightward, so we need extra width.
    const PERSON_OFFSET = COUPLE_GAP / 2 + NODE_W / 2; // 110
    let effectiveChildWidth = childrenTotalWidth;
    if (childUnits.length === 1 && childUnits[0].partnerId) {
      effectiveChildWidth = childrenTotalWidth + PERSON_OFFSET;
    }

    return {
      personId,
      partnerId,
      childUnits,
      width: Math.max(ownWidth, effectiveChildWidth),
    };
  }

  const roots = people.filter(
    (p) =>
      !p.parentIds ||
      p.parentIds.length === 0 ||
      p.parentIds.every((pid) => !byId.has(pid))
  );

  // Sort roots so that the deepest ancestor trees are processed first.
  // This prevents a partner from being "claimed" before their own
  // ancestor line is built (e.g. Jules→Marc should be built before
  // Floranne grabs Marc as her partner).
  function descendantCount(id: string, visited: Set<string>): number {
    if (visited.has(id)) return 0;
    visited.add(id);
    const p = byId.get(id);
    if (!p) return 0;
    let count = 1;
    for (const cid of p.childrenIds ?? []) {
      count += descendantCount(cid, visited);
    }
    // Also count through partners' children
    for (const pid of p.partnerIds ?? []) {
      const partner = byId.get(pid);
      if (partner) {
        for (const cid of partner.childrenIds ?? []) {
          count += descendantCount(cid, visited);
        }
      }
    }
    return count;
  }

  roots.sort((a, b) => {
    const countA = descendantCount(a.id, new Set());
    const countB = descendantCount(b.id, new Set());
    return countB - countA; // larger tree first
  });

  const rootUnits: FamilyUnit[] = [];
  for (const root of roots) {
    if (!placed.has(root.id)) rootUnits.push(buildUnit(root.id));
  }
  // Also pick up any people who are entirely disconnected
  for (const p of people) {
    if (!placed.has(p.id)) rootUnits.push(buildUnit(p.id));
  }

  // ── Position units recursively ────────────────
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();
  let junctionCounter = 0;

  function makeNode(id: string, x: number, y: number) {
    const p = byId.get(id)!;
    nodes.push({
      id: p.id,
      type: "personNode",
      position: { x: x - NODE_W / 2, y },
      data: {
        label: getDisplayName(p),
        lifespan: getLifespan(p),
        birthPlace: formatTreeBirthPlace(p),
        gender: p.gender,
        person: p,
      },
    });
  }

  function makeJunction(x: number, y: number): string {
    const id = `__junction_${junctionCounter++}`;
    nodes.push({
      id,
      type: "junctionNode",
      position: { x, y },
      data: { label: "" },
      selectable: false,
      focusable: false,
    });
    return id;
  }

  const solidStyle = { stroke: "#64748b", strokeWidth: 2 };
  const dottedStyle = { stroke: "#94a3b8", strokeWidth: 1.5, strokeDasharray: "4 4" };

  function addEdge(
    source: string,
    target: string,
    opts?: Partial<Edge>
  ) {
    const key = opts?.id ?? `${source}->${target}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({
      id: key,
      source,
      target,
      type: "smoothstep",
      style: solidStyle,
      ...opts,
    });
  }

  function layoutUnit(unit: FamilyUnit, centerX: number, y: number) {
    // Place person (+ partner), male on left, female on right
    if (unit.partnerId) {
      const person = byId.get(unit.personId)!;
      const partner = byId.get(unit.partnerId)!;
      // Determine left/right: male goes left, female goes right
      let leftId = unit.personId;
      let rightId = unit.partnerId;
      if (partner.gender === "male" && person.gender !== "male") {
        leftId = unit.partnerId;
        rightId = unit.personId;
      } else if (person.gender === "female" && partner.gender !== "female") {
        leftId = unit.partnerId;
        rightId = unit.personId;
      }
      const leftX = centerX - COUPLE_GAP / 2 - NODE_W / 2;
      const rightX = centerX + COUPLE_GAP / 2 + NODE_W / 2;
      makeNode(leftId, leftX, y);
      makeNode(rightId, rightX, y);
    } else {
      makeNode(unit.personId, centerX, y);
    }

    if (unit.childUnits.length === 0) return;

    // ── Lay out children ──────────────────────────
    const PERSON_OFFSET = COUPLE_GAP / 2 + NODE_W / 2; // 110
    const childCenters: { unitRef: FamilyUnit; cx: number }[] = [];

    if (unit.childUnits.length === 1) {
      // Single child: center the child PERSON under the parents.
      // If the child has a partner, offset the couple so the child
      // person lands directly at centerX. The offset direction depends
      // on which side the child person ends up (male=left, female=right).
      const child = unit.childUnits[0];
      let childUnitCenter = centerX;
      if (child.partnerId) {
        const childPerson = byId.get(child.personId)!;
        const childPartner = byId.get(child.partnerId)!;
        // Will the child person be placed on the right side?
        const childOnRight =
          (childPartner.gender === "male" && childPerson.gender !== "male") ||
          (childPerson.gender === "female" && childPartner.gender !== "female");
        childUnitCenter = childOnRight
          ? centerX - PERSON_OFFSET   // child is on right, shift couple left
          : centerX + PERSON_OFFSET;  // child is on left, shift couple right
      }
      childCenters.push({ unitRef: child, cx: childUnitCenter });
      layoutUnit(child, childUnitCenter, y + NODE_H + V_GAP);
    } else {
      // Multiple children: center the group under the parents.
      const childrenTotalWidth =
        unit.childUnits.reduce((sum, u) => sum + u.width, 0) +
        (unit.childUnits.length - 1) * H_GAP;
      let childX = centerX - childrenTotalWidth / 2;

      for (const childUnit of unit.childUnits) {
        const childCenterX = childX + childUnit.width / 2;
        childCenters.push({ unitRef: childUnit, cx: childCenterX });
        layoutUnit(childUnit, childCenterX, y + NODE_H + V_GAP);
        childX += childUnit.width + H_GAP;
      }
    }

    // ── Connect parents to children via centered junction ──
    const junctionY = y + NODE_H + V_GAP / 2;
    const dropJunctionId = makeJunction(centerX, junctionY);

    // Solid drop from primary parent to junction
    addEdge(unit.personId, dropJunctionId, {
      id: `drop_${unit.personId}_${dropJunctionId}`,
      style: solidStyle,
    });
    // Solid drop from partner to junction (if couple)
    if (unit.partnerId) {
      addEdge(unit.partnerId, dropJunctionId, {
        id: `drop_${unit.partnerId}_${dropJunctionId}`,
        style: solidStyle,
      });
    }

    if (unit.childUnits.length === 1) {
      // ── Single child: solid drop from junction to child ──
      const child = unit.childUnits[0];
      addEdge(dropJunctionId, child.personId, {
        id: `child_${dropJunctionId}_${child.personId}`,
        style: solidStyle,
      });
    } else {
      // ── Multiple children: dotted fan-out from junction ──
      for (const { unitRef, cx } of childCenters) {
        const cjId = makeJunction(cx, junctionY);
        addEdge(dropJunctionId, cjId, {
          id: `bar_${dropJunctionId}_${cjId}`,
          type: "straight",
          style: dottedStyle,
        });
        addEdge(cjId, unitRef.personId, {
          id: `child_${cjId}_${unitRef.personId}`,
          style: dottedStyle,
        });
      }
    }
  }

  // ── Bridge detection: find a person in a sub-tree whose child is
  //    already placed in the main layout ──────────────────────────
  interface BridgeInfo {
    bridgeUnit: FamilyUnit;
    bridgePersonId: string;
    bridgePartnerId?: string;
    placedChildId: string;
  }

  function findBridge(unit: FamilyUnit): BridgeInfo | null {
    for (const id of [unit.personId, unit.partnerId].filter(Boolean) as string[]) {
      const person = byId.get(id)!;
      for (const cid of person.childrenIds ?? []) {
        if (nodes.some((n) => n.id === cid)) {
          return {
            bridgeUnit: unit,
            bridgePersonId: id,
            bridgePartnerId:
              id === unit.personId ? unit.partnerId : unit.personId,
            placedChildId: cid,
          };
        }
      }
    }
    for (const childUnit of unit.childUnits) {
      const result = findBridge(childUnit);
      if (result) return result;
    }
    return null;
  }

  // ── Layout the first (biggest) root unit centered ──
  if (rootUnits.length > 0) {
    layoutUnit(rootUnits[0], 0, 0);
  }

  // ── Process remaining root units via bridge detection ──
  // Collect truly separate roots to lay out side-by-side afterward
  const separateUnits: FamilyUnit[] = [];

  for (let i = 1; i < rootUnits.length; i++) {
    const unit = rootUnits[i];
    const bridge = findBridge(unit);

    if (!bridge) {
      separateUnits.push(unit);
      continue;
    }

    // Layout sub-tree at temporary position (origin)
    const startNodeIdx = nodes.length;
    layoutUnit(unit, 0, 0);

    // Find bridge person & placed child positions
    const addedNodes = nodes.slice(startNodeIdx);
    const bridgeNode = addedNodes.find(
      (n) => n.id === bridge.bridgePersonId
    );
    const childNode = nodes
      .slice(0, startNodeIdx)
      .find((n) => n.id === bridge.placedChildId);

    if (!bridgeNode || !childNode) {
      separateUnits.push(unit);
      continue;
    }

    // Compute shift so bridge person is one generation above their child
    const bridgeCX = bridgeNode.position.x + NODE_W / 2;
    const childCX = childNode.position.x + NODE_W / 2;
    const targetY = childNode.position.y - NODE_H - V_GAP;
    const dx = childCX - bridgeCX;
    const dy = targetY - bridgeNode.position.y;

    for (const n of addedNodes) {
      n.position.x += dx;
      n.position.y += dy;
    }

    // ── Overlap detection: nudge entire sub-tree right until clear ──
    const existingNodes = nodes.slice(0, startNodeIdx);
    function subTreeOverlaps(): boolean {
      for (const a of addedNodes) {
        const al = a.position.x;
        const ar = a.position.x + NODE_W;
        for (const e of existingNodes) {
          if (Math.abs(a.position.y - e.position.y) > 1) continue;
          const el = e.position.x;
          const er = e.position.x + NODE_W;
          if (!(ar + H_GAP / 2 <= el || al - H_GAP / 2 >= er)) return true;
        }
      }
      return false;
    }
    while (subTreeOverlaps()) {
      for (const n of addedNodes) n.position.x += NODE_W / 4;
    }

    // ── Add connecting edges: bridge parent(s) → placed child ──
    const coupleCenterX =
      bridge.bridgePartnerId
        ? (bridgeNode.position.x +
            NODE_W / 2 +
            (addedNodes.find((n) => n.id === bridge.bridgePartnerId)
              ?.position.x ?? bridgeNode.position.x) +
            NODE_W / 2) /
          2
        : bridgeNode.position.x + NODE_W / 2;

    const junctionY = childNode.position.y - V_GAP / 2;
    const jId = makeJunction(coupleCenterX, junctionY);

    addEdge(bridge.bridgePersonId, jId, {
      id: `drop_${bridge.bridgePersonId}_${jId}`,
      style: solidStyle,
    });
    if (bridge.bridgePartnerId) {
      addEdge(bridge.bridgePartnerId, jId, {
        id: `drop_${bridge.bridgePartnerId}_${jId}`,
        style: solidStyle,
      });
    }
    addEdge(jId, bridge.placedChildId, {
      id: `child_${jId}_${bridge.placedChildId}`,
      style: solidStyle,
    });
  }

  // ── Layout truly separate roots side-by-side ──
  if (separateUnits.length > 0) {
    // Find rightmost x of already-placed nodes
    let maxX = -Infinity;
    for (const n of nodes) {
      const right = n.position.x + NODE_W;
      if (right > maxX) maxX = right;
    }
    let sepX = maxX + H_GAP * 3;

    for (const unit of separateUnits) {
      const cx = sepX + unit.width / 2;
      layoutUnit(unit, cx, 0);
      sepX += unit.width + H_GAP * 2;
    }
  }

  // ── Partner / marriage edges ──────────────────
  people.forEach((p) => {
    p.partnerIds?.forEach((partnerId) => {
      if (byId.has(partnerId)) {
        const key = [p.id, partnerId].sort().join("<->");
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          const sourceId = key.split("<->")[0];
          const targetId = key.split("<->")[1];

          const marriage = marriages?.find(
            (m) =>
              m.partnerIds.includes(p.id) &&
              m.partnerIds.includes(partnerId)
          );

          edges.push({
            id: key,
            source: sourceId,
            target: targetId,
            sourceHandle: "partner-right",
            targetHandle: "partner-left",
            type: "marriageEdge",
            data: {
              marriageDate: marriage?.date,
              marriagePlace: marriage?.place,
              marriagePlaceDisplay: marriage?.placeDisplay,
              marriageCity: marriage?.city,
              marriageCountryCode: marriage?.countryCode,
              marriageCountry: marriage?.country,
              marriagePostcode: marriage?.postcode,
              marriageCounty: marriage?.county,
              marriageDeptCode: marriage?.deptCode,
            },
            style: {
              stroke: "#e11d48",
              strokeWidth: 2,
              strokeDasharray: "6 3",
            },
            zIndex: -1,
          });
        }
      }
    });
  });

  return { nodes, edges };
}

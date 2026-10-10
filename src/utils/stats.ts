import type { Marriage, Person } from "../types/person";
import { buildFamilyGraph, defaultFocus } from "./treeFold";

/** Figures shown by the statistics tab. Ages are computed from years only. */

export interface Count {
  label: string;
  n: number;
}

export interface Average {
  label: string;
  avg: number;
  n: number;
}

export interface GenerationRow {
  /** 1 = parents, 2 = grandparents… */
  gen: number;
  known: number;
  expected: number;
}

export interface TreeStats {
  total: number;
  men: number;
  women: number;
  withBirthDate: number;
  withBirthPlace: number;
  marriages: number;
  firstYear: number | null;
  lastYear: number | null;
  root: Person | null;
  generations: GenerationRow[];
  births: Count[];
  longevity: Average[];
  parentAge: Average[];
  marriageAge: Average[];
  surnames: Count[];
  firstNamesMen: Count[];
  firstNamesWomen: Count[];
  places: Count[];
  regions: Count[];
}

const TOP = 10;
const MAX_AGE = 110;

const year = (date?: string): number | null => {
  const y = date ? parseInt(date.slice(0, 4), 10) : NaN;
  return Number.isFinite(y) ? y : null;
};

function top(values: (string | undefined)[], limit = TOP): Count[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v?.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    .slice(0, limit);
}

class Mean {
  private sum = 0;
  n = 0;
  add(v: number) {
    this.sum += v;
    this.n++;
  }
  row(label: string): Average {
    return { label, avg: this.n ? this.sum / this.n : 0, n: this.n };
  }
}

export function computeStats(people: Person[], marriages: Marriage[] = []): TreeStats {
  const byId = new Map(people.map((p) => [p.id, p]));
  const graph = buildFamilyGraph(people);

  // ── Ancestors known per generation, from the tree's starting person ──
  const rootId = defaultFocus(graph);
  const generations: GenerationRow[] = [];
  if (rootId) {
    const seen = new Set([rootId]);
    let row = [rootId];
    for (let gen = 1; row.length > 0; gen++) {
      const next: string[] = [];
      for (const id of row) {
        for (const parent of graph.parents.get(id) ?? []) {
          if (!seen.has(parent)) {
            seen.add(parent);
            next.push(parent);
          }
        }
      }
      if (next.length > 0) generations.push({ gen, known: next.length, expected: 2 ** gen });
      row = next;
    }
  }

  // ── Dates ──
  let firstYear: number | null = null;
  let lastYear: number | null = null;
  const perHalfCentury = new Map<number, number>();
  const perCentury = new Map<number, Mean>();
  const fatherAge = new Mean();
  const motherAge = new Mean();
  for (const p of people) {
    const birth = year(p.birthDate);
    if (birth === null) continue;
    if (firstYear === null || birth < firstYear) firstYear = birth;
    if (lastYear === null || birth > lastYear) lastYear = birth;
    const half = Math.floor(birth / 50) * 50;
    perHalfCentury.set(half, (perHalfCentury.get(half) ?? 0) + 1);

    const death = year(p.deathDate);
    if (death !== null && death >= birth && death - birth <= MAX_AGE) {
      const century = Math.floor(birth / 100) * 100;
      if (!perCentury.has(century)) perCentury.set(century, new Mean());
      perCentury.get(century)!.add(death - birth);
    }
    for (const parentId of graph.parents.get(p.id) ?? []) {
      const parent = byId.get(parentId)!;
      const parentBirth = year(parent.birthDate);
      if (parentBirth === null) continue;
      const age = birth - parentBirth;
      if (age < 12 || age > 80) continue; // inconsistent dates: see the checks
      if (parent.gender === "female") motherAge.add(age);
      else if (parent.gender === "male") fatherAge.add(age);
    }
  }

  const menMarriage = new Mean();
  const womenMarriage = new Mean();
  for (const m of marriages) {
    const date = year(m.date);
    if (date === null) continue;
    for (const id of m.partnerIds) {
      const p = byId.get(id);
      const birth = year(p?.birthDate);
      if (!p || birth === null) continue;
      const age = date - birth;
      if (age < 12 || age > MAX_AGE) continue;
      if (p.gender === "female") womenMarriage.add(age);
      else if (p.gender === "male") menMarriage.add(age);
    }
  }

  const sorted = <T,>(map: Map<number, T>) => [...map.entries()].sort((a, b) => a[0] - b[0]);

  return {
    total: people.length,
    men: people.filter((p) => p.gender === "male").length,
    women: people.filter((p) => p.gender === "female").length,
    withBirthDate: people.filter((p) => p.birthDate).length,
    withBirthPlace: people.filter((p) => p.birthPlace || p.birthCity).length,
    marriages: marriages.length,
    firstYear,
    lastYear,
    root: rootId ? byId.get(rootId) ?? null : null,
    generations,
    births: sorted(perHalfCentury).map(([start, n]) => ({ label: `${start}–${start + 49}`, n })),
    longevity: sorted(perCentury).map(([start, mean]) => mean.row(`${start}–${start + 99}`)),
    parentAge: [fatherAge.row("father"), motherAge.row("mother")],
    marriageAge: [menMarriage.row("men"), womenMarriage.row("women")],
    surnames: top(people.map((p) => p.lastName?.toUpperCase())),
    firstNamesMen: top(people.filter((p) => p.gender === "male").map((p) => p.firstName)),
    firstNamesWomen: top(people.filter((p) => p.gender === "female").map((p) => p.firstName)),
    places: top(
      people.map((p) => {
        const city = p.birthCity || p.birthPlaceDisplay || p.birthPlace?.split(",")[0];
        if (!city) return undefined;
        return p.birthDeptCode ? `${city} (${p.birthDeptCode})` : city;
      })
    ),
    regions: top(
      people.map((p) =>
        p.birthCountryCode === "fr" && p.birthCounty
          ? `${p.birthCounty}${p.birthDeptCode ? ` (${p.birthDeptCode})` : ""}`
          : p.birthCountry
      )
    ),
  };
}

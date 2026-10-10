import type { Marriage, Person } from "../types/person";

/**
 * Consistency checks on a tree: dates and links that cannot both be true.
 *
 * Read-only: nothing is corrected, each issue only points at the people
 * involved so an editor can look at the source.
 *
 * Dates may be partial ("1842", "1842-03"), so each one is treated as the
 * span of days it may stand for, and a rule only fires when it holds for the
 * whole span: "1842" is never reported as being after "1842-03-15".
 */

export type IssueKind =
  | "deathBeforeBirth"
  | "tooOld"
  | "futureDate"
  | "parentTooYoung"
  | "motherTooOld"
  | "fatherTooOld"
  | "bornAfterParentDeath"
  | "marriageBeforeBirth"
  | "marriageTooYoung"
  | "marriageAfterDeath"
  | "tooManyParents"
  | "unknownLink"
  | "ownRelative";

export interface Issue {
  kind: IssueKind;
  /** Person the issue is filed under. */
  personId: string;
  /** Other person involved (parent, partner…), if any. */
  otherId?: string;
  /** Values for the message: years, ages. */
  values: Record<string, string>;
}

const MAX_AGE = 110;
const MIN_PARENT_AGE = 12;
const MAX_MOTHER_AGE = 55;
const MAX_FATHER_AGE = 80;
const MIN_MARRIAGE_AGE = 12;

interface Span {
  /** earliest and latest moment, in fractional years */
  lo: number;
  hi: number;
  year: number;
}

function span(date?: string): Span | null {
  if (!date) return null;
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(date);
  if (!m) return null;
  const year = Number(m[1]);
  if (!m[2]) return { lo: year, hi: year + 1, year };
  const month = Number(m[2]) - 1;
  if (!m[3]) return { lo: year + month / 12, hi: year + (month + 1) / 12, year };
  const at = year + month / 12 + (Number(m[3]) - 1) / 365;
  return { lo: at, hi: at + 1 / 365, year };
}

export function findIssues(people: Person[], marriages: Marriage[] = []): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const now = new Date().getFullYear() + 1;
  const add = (kind: IssueKind, personId: string, values: Record<string, string | number> = {}, otherId?: string) => {
    const strings: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) strings[k] = String(v);
    issues.push({ kind, personId, otherId, values: strings });
  };

  for (const p of people) {
    const birth = span(p.birthDate);
    const death = span(p.deathDate);

    if (birth && death) {
      if (death.hi <= birth.lo) add("deathBeforeBirth", p.id, { birth: birth.year, death: death.year });
      else if (death.lo - birth.hi > MAX_AGE) add("tooOld", p.id, { age: Math.floor(death.lo - birth.hi) });
    }
    if ((birth && birth.lo > now) || (death && death.lo > now)) {
      add("futureDate", p.id, { year: Math.max(birth?.year ?? 0, death?.year ?? 0) });
    }

    const parents = p.parentIds ?? [];
    if (parents.length > 2) add("tooManyParents", p.id, { n: parents.length });
    for (const [field, ids] of [
      ["parents", parents],
      ["partners", p.partnerIds ?? []],
      ["children", p.childrenIds ?? []],
    ] as const) {
      if (ids.includes(p.id)) add("ownRelative", p.id, { field });
      const missing = ids.filter((id) => !byId.has(id)).length;
      if (missing > 0) add("unknownLink", p.id, { field, n: missing });
    }

    if (!birth) continue;
    for (const parentId of parents) {
      const parent = byId.get(parentId);
      if (!parent || parent.id === p.id) continue;
      const pBirth = span(parent.birthDate);
      const pDeath = span(parent.deathDate);
      if (pBirth) {
        // largest and smallest age the parent can have had
        const oldest = birth.hi - pBirth.lo;
        const youngest = birth.lo - pBirth.hi;
        if (oldest < MIN_PARENT_AGE) {
          add("parentTooYoung", p.id, { age: Math.floor(oldest), parentBirth: pBirth.year, birth: birth.year }, parent.id);
        } else if (parent.gender === "female" && youngest > MAX_MOTHER_AGE) {
          add("motherTooOld", p.id, { age: Math.floor(youngest) }, parent.id);
        } else if (parent.gender !== "female" && youngest > MAX_FATHER_AGE) {
          add("fatherTooOld", p.id, { age: Math.floor(youngest) }, parent.id);
        }
      }
      if (pDeath) {
        // a father can die up to nine months before the birth
        const grace = parent.gender === "female" ? 0 : 0.8;
        if (birth.lo > pDeath.hi + grace) {
          add("bornAfterParentDeath", p.id, { death: pDeath.year, birth: birth.year }, parent.id);
        }
      }
    }
  }

  for (const m of marriages) {
    const date = span(m.date);
    if (!date) continue;
    const [a, b] = m.partnerIds;
    for (const [id, otherId] of [[a, b], [b, a]]) {
      const p = byId.get(id);
      if (!p) continue;
      const birth = span(p.birthDate);
      const death = span(p.deathDate);
      if (birth && date.hi <= birth.lo) {
        add("marriageBeforeBirth", id, { marriage: date.year, birth: birth.year }, otherId);
      } else if (birth && date.hi - birth.lo < MIN_MARRIAGE_AGE) {
        add("marriageTooYoung", id, { age: Math.floor(date.hi - birth.lo), marriage: date.year, birth: birth.year }, otherId);
      }
      if (death && date.lo > death.hi) {
        add("marriageAfterDeath", id, { marriage: date.year, death: death.year }, otherId);
      }
    }
  }

  return issues;
}

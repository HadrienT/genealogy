import { useFamily } from "./useFamily";
import { useI18n, type TranslationKey } from "./useI18n";
import type { Issue } from "../utils/checks";
import type { Person } from "../types/person";

export const nameOf = (p?: Person) =>
  p ? [p.firstName, p.lastName].filter(Boolean).join(" ") || `#${p.id.slice(0, 6)}` : "?";

/** Sentence describing an issue, from the point of view of the person it is filed under. */
export function useIssueText() {
  const { getPersonById } = useFamily();
  const { t } = useI18n();
  return (issue: Issue) =>
    t(`issue.${issue.kind}` as TranslationKey, {
      ...issue.values,
      field: issue.values.field ? t(`issue.field.${issue.values.field}` as TranslationKey) : "",
      other: issue.otherId ? nameOf(getPersonById(issue.otherId)) : "",
    });
}

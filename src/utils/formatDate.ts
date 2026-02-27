/**
 * Format a date string (ISO-like) into "day month year" display format.
 *
 * Handles partial dates gracefully:
 *   "1990"       → "1990"
 *   "1990-07"    → "July 1990"
 *   "1990-07-22" → "22 July 1990"
 *
 * Accepts an optional months array for i18n.
 */

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatDate(raw: string | undefined, months?: string[]): string {
  if (!raw) return "";

  const monthNames = months ?? MONTHS_EN;
  const parts = raw.split("-");

  // Year only: "1990"
  if (parts.length === 1) return parts[0];

  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = monthNames[monthIdx] ?? parts[1];

  // Year + month: "1990-07" → "July 1990"
  if (parts.length === 2) return `${monthName} ${year}`;

  // Full date: "1990-07-22" → "22 July 1990"
  const day = parseInt(parts[2], 10);
  return `${day} ${monthName} ${year}`;
}

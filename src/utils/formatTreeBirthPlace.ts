import type { Person } from "../types/person";

/**
 * Derive the French department number from a postcode.
 *
 * Rules:
 *  - Mainland (01–19, 21–95): first 2 digits
 *  - Corsica: postcodes 20000–20190 → "2A", 20200+ → "2B"
 *  - DOM-TOM (971–976): first 3 digits
 */
function deptFromPostcode(postcode: string): string | undefined {
  const trimmed = postcode.trim();
  if (trimmed.length < 2) return undefined;

  // DOM-TOM: 97x
  if (trimmed.startsWith("97") && trimmed.length >= 3) {
    return trimmed.substring(0, 3);
  }

  // Corsica: starts with 20
  if (trimmed.startsWith("20")) {
    const num = parseInt(trimmed, 10);
    return num < 20200 ? "2A" : "2B";
  }

  // Mainland
  return trimmed.substring(0, 2);
}

/**
 * Format a person's birth place for compact tree-node display.
 *
 * - France  → "City (department number)"   e.g. "Marseille (13)"
 * - Abroad  → "City (Country)"             e.g. "New York (États-Unis)"
 * - Fallback: raw `birthPlace` string, or empty.
 */
export function formatTreeBirthPlace(p: Person): string {
  const displayName = p.birthPlaceDisplay;
  const city = displayName || p.birthCity;
  const countryCode = p.birthCountryCode;

  // If we have structured data
  if (city && countryCode) {
    if (countryCode === "fr") {
      // Prefer department code from ISO3166-2-lvl6 (most reliable)
      if (p.birthDeptCode) return `${city} (${p.birthDeptCode})`;
      // Fallback: derive from postcode
      const dept = p.birthPostcode ? deptFromPostcode(p.birthPostcode) : undefined;
      if (dept) return `${city} (${dept})`;
      // Fallback: show county (department name) if available
      if (p.birthCounty) return `${city} (${p.birthCounty})`;
      return city;
    }
    // Other country
    const country = p.birthCountry || countryCode.toUpperCase();
    return `${city} (${country})`;
  }

  // No structured data — extract first segment (city) from raw birthPlace
  if (p.birthPlace) {
    return p.birthPlace.split(",")[0].trim();
  }
  return "";
}

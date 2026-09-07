import type { Marriage } from "../types/person";

/**
 * Derive the French department number from a postcode.
 *  - Mainland (01–95): first 2 digits
 *  - Corsica: 20000–20199 → "2A", 20200+ → "2B"
 *  - Overseas (971–976): first 3 digits
 */
function deptFromPostcode(postcode: string): string | undefined {
  const trimmed = postcode.trim();
  if (trimmed.length < 2) return undefined;
  if (trimmed.startsWith("97") && trimmed.length >= 3) return trimmed.substring(0, 3);
  if (trimmed.startsWith("20")) {
    const num = parseInt(trimmed, 10);
    return Number.isFinite(num) && num < 20200 ? "2A" : "2B";
  }
  return trimmed.substring(0, 2);
}

/**
 * Compact display for a marriage place.
 *  - France → "City (dept)"      e.g. "Marseille (13)"
 *  - Abroad → "City (Country)"   e.g. "Turin (Italie)"
 *  - Fallback → first segment of the raw place string.
 */
export function formatMarriagePlace(m: Marriage): string | undefined {
  const city = m.placeDisplay || m.city;
  const countryCode = m.countryCode;

  if (city && countryCode) {
    if (countryCode === "fr") {
      if (m.deptCode) return `${city} (${m.deptCode})`;
      const dept = m.postcode ? deptFromPostcode(m.postcode) : undefined;
      if (dept) return `${city} (${dept})`;
      if (m.county) return `${city} (${m.county})`;
      return city;
    }
    const country = m.country || countryCode.toUpperCase();
    return `${city} (${country})`;
  }

  if (m.place) {
    const comma = m.place.indexOf(",");
    return comma > 0 ? m.place.substring(0, comma).trim() : m.place;
  }
  return undefined;
}

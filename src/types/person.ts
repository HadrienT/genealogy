/**
 * Core data model for a person in the family tree.
 *
 * Design choices:
 *  - Every field except `id` is optional → handles missing data gracefully.
 *  - Relationships are stored as ID references → flat structure, easy to serialize.
 *  - `parentIds` is an array (0‑2 entries typically).
 *  - `partnerIds` supports multiple partnerships over a lifetime.
 *  - `childrenIds` is derived but stored for convenience / quick traversal.
 *  - Coordinates are stored directly on the person for the birth map.
 */

export interface Person {
  id: string;

  // ── Identity ──────────────────────────────────
  firstName?: string;
  middleNames?: string;
  lastName?: string;
  maidenName?: string;
  gender?: "male" | "female" | "other";
  photo?: string; // URL or base‑64 data URI

  // ── Dates ─────────────────────────────────────
  birthDate?: string; // ISO 8601 partial: "1842", "1842-03", "1842-03-15"
  deathDate?: string;

  // ── Places ────────────────────────────────────
  birthPlace?: string;
  birthPlaceDisplay?: string; // Historical / alternate name for display
  birthCoordinates?: {
    lat: number;
    lng: number;
  };
  /** Structured address fields (populated from Nominatim) */
  birthCity?: string;
  birthCountryCode?: string; // ISO 3166-1 alpha-2, lowercase (e.g. "fr")
  birthCountry?: string;
  birthPostcode?: string;
  birthCounty?: string; // department name for France
  birthDeptCode?: string; // French department number from ISO3166-2-lvl6 (e.g. "13", "2A")

  deathPlace?: string;
  deathPlaceDisplay?: string; // Historical / alternate name for display
  deathCoordinates?: {
    lat: number;
    lng: number;
  };
  /** Structured death address fields (populated from Nominatim) */
  deathCity?: string;
  deathCountryCode?: string;
  deathCountry?: string;
  deathPostcode?: string;
  deathCounty?: string;
  deathDeptCode?: string;

  // ── Relationships (ID references) ─────────────
  parentIds?: string[];
  partnerIds?: string[];
  childrenIds?: string[];

  // ── Freeform ──────────────────────────────────
  occupation?: string;
  notes?: string;
}

export interface Marriage {
  /** IDs of the two partners (order doesn't matter) */
  partnerIds: [string, string];
  date?: string;
  place?: string;
  placeDisplay?: string;
  city?: string;
  countryCode?: string;
  country?: string;
  postcode?: string;
  county?: string;
  deptCode?: string;
}

export interface FamilyData {
  people: Person[];
  marriages?: Marriage[];
}

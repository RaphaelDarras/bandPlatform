// Platform API types skeleton (Phase 5 reuse).
// This package is deliberately type-only for Phase 4 — no runtime code,
// no fetch functions. Concerts on the showcase website come from the
// Bandsintown API (web/src/lib/bandsintown.ts), not this package (D-08/D-10).

/**
 * Mirrors the platform API's Concert model (see mobile/src/api/concerts.ts).
 */
export interface Concert {
  id: string;
  venue: string;
  date: string; // ISO date string
  country: string;
  city: string;
  currency: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

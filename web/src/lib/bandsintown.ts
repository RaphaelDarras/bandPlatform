// Build-time-only Bandsintown client (web-only, D-10).
//
// The artist API key is read from a NON-VITE_ env var so it is never inlined
// into the client bundle (D-09). This module runs during `vite-react-ssg build`
// inside the SSG loader; the fetched events are baked into static HTML.
//
// Full network verification against the live payload + fixture tests are owned
// by Plan 04-02. Here we only guarantee it compiles and fails soft (returns [])
// when no key is set, so the build never blocks (D-12).

const ARTIST_ID = '433176' // Hurakan — verified live 2026-07-02 (NOT 90017994)

/**
 * Shape locked from the live Hurakan payload (RESEARCH Pitfall 2).
 * Minimum fields Wave 1 consumes are typed precisely; the rest mirror the
 * real response so downstream plans can rely on them without re-verifying.
 */
export interface BitVenue {
  name: string // ⚠ for festivals this equals `title` — prefer `location` for display
  location: string // e.g. "Gravigny, France"
  city: string
  country: string
  region: string
  street_address: string
  postal_code: string
  latitude: string
  longitude: string
}

export interface BitOffer {
  status: string
  type: string
  url: string // ⚠ echoes app_id — strip with clean() before rendering (Pitfall 8)
}

export interface BitEvent {
  id: string
  url: string // ⚠ echoes app_id — strip with clean() before rendering (Pitfall 8)
  datetime: string // ISO, e.g. "2026-08-29T15:00:00"
  title?: string
  description?: string
  artist_id: string
  lineup: string[]
  offers: BitOffer[]
  free: boolean
  sold_out: boolean
  starts_at: string
  ends_at: string
  on_sale_datetime: string
  festival_start_date: string
  festival_end_date: string
  datetime_display_rule: string
  festival_datetime_display_rule: string
  bandsintown_plus: boolean
  presale: string
  venue: BitVenue
}

/**
 * Strip the app_id query param from any Bandsintown URL before rendering it
 * into static HTML, so the key never reaches the browser (D-09, Pitfall 8).
 */
export function clean(u: string): string {
  try {
    const x = new URL(u)
    x.searchParams.delete('app_id')
    return x.toString()
  } catch {
    return u
  }
}

/**
 * Return the soonest upcoming event, or null when there are none. Reused by
 * Home's next-concert teaser (D-25) and Concerts' full listing.
 */
export function nextEvent(events: BitEvent[]): BitEvent | null {
  return events[0] ?? null
}

/**
 * Display-friendly venue string. Mitigates the festival-quirk where
 * Bandsintown returns the festival `title` as `venue.name` instead of the
 * real venue name (RESEARCH Pitfall 2) — in that case prefer
 * `venue.location` + `title`. Otherwise use `venue.name`.
 */
export function venueDisplay(e: BitEvent): string {
  if (e.title && e.venue.name === e.title) {
    return `${e.venue.location} — ${e.title}`
  }
  return e.venue.name
}

/**
 * Fetch upcoming events at build time. Returns [] on any non-ok response,
 * thrown error, or missing API key (fail-soft → empty state, D-12).
 *
 * The entire network body is guarded by `import.meta.env.SSR`. During the
 * client build Vite substitutes that to `false` and dead-code-eliminates the
 * branch, so neither the API key nor the `app_id` query string is ever shipped
 * to the browser (D-09, RESEARCH Pattern 2 / Pitfall 8). This runs only in the
 * SSG (build) render.
 */
export async function fetchUpcomingEvents(): Promise<BitEvent[]> {
  if (!import.meta.env.SSR) return [] // never runs / ships in the client bundle
  const appId = process.env.BANDSINTOWN_APP_ID // build-time only — NOT VITE_-prefixed
  if (!appId) return [] // no key locally → empty state, build still succeeds
  try {
    const url =
      `https://rest.bandsintown.com/artists/id_${ARTIST_ID}/events/` +
      `?app_id=${appId}&date_range=upcoming`
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[bandsintown] fetch failed with status ${res.status}, falling back to []`)
      return []
    }
    return (await res.json()) as BitEvent[]
  } catch (err) {
    console.warn('[bandsintown] fetch threw, falling back to []:', err)
    return []
  }
}

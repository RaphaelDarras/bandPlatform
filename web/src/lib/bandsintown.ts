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

/**
 * Nested artist object present on the live payload. Its `url` (and other link
 * fields) echo the app_id exactly like the event/offer urls — the field was
 * previously undeclared, so it slipped through the field-by-field sanitizer and
 * leaked the key into the SSG hydration JSON (SECURITY regression, D-09). Typed
 * here + scrubbed by the recursive sanitizer below.
 */
export interface BitArtist {
  name?: string
  url?: string
  [key: string]: unknown
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
  artist?: BitArtist // ⚠ nested links echo app_id — scrubbed by sanitizeEvent (D-09)
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
 * Remove app_id from a single string. Uses proper URL parsing when possible;
 * falls back to a textual strip for query fragments that don't parse as a full
 * URL, so any string echoing the key is still scrubbed (defence-in-depth).
 */
function stripAppIdFromString(s: string): string {
  if (!s.includes('app_id')) return s
  try {
    const x = new URL(s)
    x.searchParams.delete('app_id')
    return x.toString()
  } catch {
    return s.replace(/[?&]app_id=[^&#\s]*/gi, '')
  }
}

/**
 * Recursively strip app_id from every string in an object/array tree.
 */
function deepStripAppId<T>(value: T): T {
  if (typeof value === 'string') return stripAppIdFromString(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => deepStripAppId(v)) as unknown as T
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = deepStripAppId(v)
    return out as T
  }
  return value
}

/**
 * Strip app_id from an event at the fetch boundary so the *data* baked into the
 * SSG hydration payload never carries the secret — not just the HTML rendered
 * from it (Pitfall 8: the raw loader result is serialized to static-loader-data
 * JSON for client hydration, so cleaning only at JSX render sites would leave
 * the key in that JSON).
 *
 * Uses recursive redaction rather than cleaning named fields one-by-one: the
 * live payload echoes app_id in a nested `artist.url` that was undeclared on
 * BitEvent and thus previously leaked (SECURITY, D-09). Recursion scrubs any
 * current or future field that carries the key.
 */
export function sanitizeEvent(e: BitEvent): BitEvent {
  return deepStripAppId(e)
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
    const events = (await res.json()) as BitEvent[]
    return events.map(sanitizeEvent)
  } catch (err) {
    console.warn('[bandsintown] fetch threw, falling back to []:', err)
    return []
  }
}

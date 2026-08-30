// Build-time-only Shopify storefront reader.
//
// Uses the storefront's PUBLIC /products.json endpoint rather than the Admin
// GraphQL API the `api` package talks to. That matters: this code runs during
// the Vercel web build, and products.json needs no token at all, so no
// Shopify credential has to exist in the web build environment (the Admin
// client id/secret stay on Render, where the sync lives).
//
// Like fetchUpcomingEvents, the network body is guarded by import.meta.env.SSR
// so it is dead-code-eliminated from the client bundle and runs only in the
// SSG render. Fails soft: any error yields an empty catalogue, and the caller
// falls back to a plain storefront link.

export const STORE_URL = 'https://shop.hurakanband.fr/'

/**
 * The market to price against. This is NOT optional decoration: products.json
 * localises prices — including the CURRENCY — to the requesting IP's market
 * when no country is given. A local fetch from France returned 15.00 EUR while
 * the Vercel build, running in a US region, got 18.00 USD for the same product
 * (~the same money, converted). The site then rendered "18,00 €", because the
 * formatter assumed EUR. Pinning FR makes the build deterministic no matter
 * which region it runs in, and FR is the right market for a French band's .fr
 * site. The band collects no VAT in any market, so none of this is tax —
 * purely currency conversion with Shopify's rounding rules.
 */
const MARKET_COUNTRY = 'FR'

/**
 * Shopify collection that curates everything EXCEPT the preorder items. It is
 * maintained by the band in the Shopify admin, so what counts as "not a
 * preorder" is their editorial call, not a string match in our code.
 */
export const MERCH_COLLECTION = 'all-no-preorder'

/** Endpoint used at build time. Exported so the market pin is testable. */
export function productsEndpoint(limit = 250): string {
  // limit=250 is the endpoint maximum and the store holds ~25 products; if it
  // ever outgrows that, this needs `&page=` pagination.
  return `${STORE_URL}products.json?limit=${limit}&country=${MARKET_COUNTRY}`
}

/** Same, for a single collection. Verified to honour the country pin. */
export function collectionEndpoint(handle: string, limit = 250): string {
  return `${STORE_URL}collections/${handle}/products.json?limit=${limit}&country=${MARKET_COUNTRY}`
}

/** One product, flattened to just what a card renders. */
export interface ShopProduct {
  handle: string
  /** Cleaned-up store title (see displayTitle). */
  label: string
  /** Deep link to the product's own detail page on the storefront. */
  url: string
  price: string
  image: string | null
  available: boolean
}

/**
 * The two catalogue slices the home page renders. They PARTITION the store:
 * `merch` is the all-no-preorder collection, `preorder` is everything else, so
 * no product appears in both sections.
 */
export interface Catalogue {
  preorder: ShopProduct[]
  merch: ShopProduct[]
}

/** The subset of the products.json payload this module reads. */
interface ShopifyProduct {
  handle: string
  title: string
  images: { src: string }[]
  variants: {
    price: string
    /** Currency the price is quoted in — varies with the requesting market. */
    price_currency?: string
    available: boolean
  }[]
}

/**
 * Format a price in the currency Shopify actually priced it in, never an
 * assumed one. The payload's price_currency is the authority: hardcoding EUR
 * is what turned a USD figure into "18,00 €" on the live site. Falls back to
 * EUR only when the field is absent, which matches the pinned FR market.
 *
 * Prices are all-inclusive — the band is under franchise en base de TVA and
 * collects no VAT in any market, so there is never a tax line to add.
 */
function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount)
  } catch {
    // Unknown/malformed currency code — show the bare number rather than
    // labelling it with a symbol that might be wrong.
    return String(amount)
  }
}

/**
 * Store titles are written for the storefront, not for a teaser:
 *   PREORDER - VINYL - "ETERNAL SCARS" SPLATTER GOLD/BLACK LIMITED
 * Strip the redundant PREORDER prefix (the section heading already says it)
 * and normalise the quote characters. Everything else is left alone: the
 * titles are already uppercase, which suits the display face.
 */
export function displayTitle(title: string): string {
  return title
    .replace(/^\s*pre[\s-]?order\s*[-–—:]\s*/i, '')
    .replace(/[“”‘’]/g, '"')
    .trim()
}

/**
 * Shopify CDN images are served at their upload size unless asked otherwise.
 * Cards render at ~400px, so request 800 for 2x displays. The CDN
 * content-negotiates WebP, so a real browser gets ~38KB where the source PNG
 * is ~250KB.
 */
export function sized(src: string, width = 800): string {
  try {
    const u = new URL(src)
    u.searchParams.set('width', String(width))
    return u.toString()
  } catch {
    return src
  }
}

/** Flatten one payload product into the shape a card needs. */
export function toShopProduct(p: ShopifyProduct): ShopProduct {
  const cheapest = p.variants
    .filter((v) => Number.isFinite(Number(v.price)))
    .sort((a, b) => Number(a.price) - Number(b.price))[0]

  return {
    handle: p.handle,
    label: displayTitle(p.title),
    url: `${STORE_URL}products/${p.handle}`,
    price: cheapest
      ? formatPrice(Number(cheapest.price), cheapest.price_currency ?? 'EUR')
      : '',
    image: p.images[0] ? sized(p.images[0].src) : null,
    available: p.variants.some((v) => v.available),
  }
}

/**
 * Partition the store into its two sections.
 *
 * `merch` is exactly the all-no-preorder collection. `preorder` is every other
 * product in the store — derived by subtraction rather than by matching
 * "PREORDER" in a title, so the band's own collection is the single source of
 * truth and a rename in Shopify can't silently drop an item from both grids.
 * Nothing appears twice.
 */
export function toCatalogue(
  allProducts: ShopifyProduct[],
  merchProducts: ShopifyProduct[],
): Catalogue {
  const merchHandles = new Set(merchProducts.map((p) => p.handle))
  return {
    preorder: allProducts.filter((p) => !merchHandles.has(p.handle)).map(toShopProduct),
    merch: merchProducts.map(toShopProduct),
  }
}

/**
 * Fetch the whole catalogue at build time. Returns empty slices on any
 * non-ok response or thrown error so the build never blocks; Home then falls
 * back to a plain link to the storefront.
 *
 * In dev (and in the client bundle) this returns empty immediately — same
 * fail-soft shape as the Bandsintown client, so `npm run dev` shows the
 * fallback rather than making a live call on every page load.
 */
export async function fetchCatalogue(): Promise<Catalogue> {
  const empty: Catalogue = { preorder: [], merch: [] }
  if (!import.meta.env.SSR) return empty // never runs / ships in the client bundle

  const load = async (url: string): Promise<ShopifyProduct[] | null> => {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[shopify] ${url} failed with status ${res.status}`)
      return null
    }
    const body = (await res.json()) as { products?: ShopifyProduct[] }
    return body.products ?? []
  }

  try {
    const [all, merch] = await Promise.all([
      load(productsEndpoint()),
      load(collectionEndpoint(MERCH_COLLECTION)),
    ])
    // Both are needed to partition: without the collection we cannot tell which
    // products are preorders, so fall back rather than guess and mis-file them.
    if (!all || !merch) return empty
    return toCatalogue(all, merch)
  } catch (err) {
    console.warn('[shopify] catalogue fetch threw, falling back:', err)
    return empty
  }
}

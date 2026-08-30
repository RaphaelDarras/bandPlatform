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
// SSG render. Fails soft: any error yields [], and the caller falls back to a
// plain storefront link.

export const STORE_URL = 'https://shop.hurakanband.fr/'

/**
 * The market to price against. This is NOT optional decoration: products.json
 * localises prices to the *requesting* IP's market when no country is given.
 * A local fetch from France returned 15.00 while the Vercel build, running in
 * a US region, got 18.00 for the same product — a silent +20% on every price
 * baked into the static HTML. Pinning FR makes the build deterministic no
 * matter which region it runs in, and FR is the right market for a French
 * band's .fr site quoting EUR.
 */
const MARKET_COUNTRY = 'FR'

/** Endpoint used at build time. Exported so the market pin is testable. */
export function productsEndpoint(limit = 250): string {
  // limit=250 is the endpoint maximum and the store holds ~25 products; if it
  // ever outgrows that, this needs `&page=` pagination.
  return `${STORE_URL}products.json?limit=${limit}&country=${MARKET_COUNTRY}`
}

/** Prices are EUR and all-inclusive (band is under franchise en base de TVA,
 *  so there is no VAT line to display). */
const EUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

/** One featured product, flattened to just what a card renders. */
export interface PreorderProduct {
  handle: string
  /** Hand-authored label from data/preorder.ts, not the shouty Shopify title. */
  label: string
  url: string
  price: string
  image: string | null
  available: boolean
}

/** The subset of the products.json payload this module reads. */
interface ShopifyProduct {
  handle: string
  title: string
  images: { src: string }[]
  variants: { price: string; available: boolean }[]
}

export interface FeaturedHandle {
  handle: string
  label: string
}

/**
 * Shopify CDN images are served at their upload size unless asked otherwise.
 * The cards render at ~300px, so request 600 for 2x displays.
 */
export function sized(src: string, width = 600): string {
  try {
    const u = new URL(src)
    u.searchParams.set('width', String(width))
    return u.toString()
  } catch {
    return src
  }
}

/**
 * Resolve hand-authored handles against a products.json payload, preserving
 * the order given in the config. Handles that no longer exist in the store are
 * skipped rather than rendered broken — so pulling a product from Shopify
 * removes it from the site on the next build with no code change.
 */
export function selectFeatured(
  products: ShopifyProduct[],
  featured: FeaturedHandle[],
): PreorderProduct[] {
  const byHandle = new Map(products.map((p) => [p.handle, p]))

  return featured.flatMap(({ handle, label }) => {
    const p = byHandle.get(handle)
    if (!p) return []

    const cheapest = p.variants
      .map((v) => Number(v.price))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)[0]

    return [
      {
        handle,
        label,
        url: `${STORE_URL}products/${handle}`,
        price: cheapest === undefined ? '' : EUR.format(cheapest),
        image: p.images[0] ? sized(p.images[0].src) : null,
        available: p.variants.some((v) => v.available),
      },
    ]
  })
}

/**
 * Fetch the featured preorder products at build time. Returns [] on any
 * non-ok response or thrown error so the build never blocks; Home then falls
 * back to a plain link to the storefront.
 *
 * In dev (and in the client bundle) this returns [] immediately — same
 * fail-soft shape as the Bandsintown client, so `npm run dev` shows the
 * fallback rather than making a live call on every page load.
 */
export async function fetchPreorderProducts(
  featured: FeaturedHandle[],
): Promise<PreorderProduct[]> {
  if (!import.meta.env.SSR) return [] // never runs / ships in the client bundle
  try {
    const res = await fetch(productsEndpoint())
    if (!res.ok) {
      console.warn(`[shopify] products.json failed with status ${res.status}, falling back to []`)
      return []
    }
    const body = (await res.json()) as { products?: ShopifyProduct[] }
    return selectFeatured(body.products ?? [], featured)
  } catch (err) {
    console.warn('[shopify] products.json threw, falling back to []:', err)
    return []
  }
}

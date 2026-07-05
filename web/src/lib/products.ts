// Runtime-only (browser) products client (D-05/D-06/D-07/D-09/D-10).
//
// UNLIKE web/src/lib/bandsintown.ts (which runs ONLY at build time, behind a
// build-vs-browser environment guard, and reads a NON-VITE_ secret so it
// never ships to the browser), this module runs ONLY in the browser and
// never at build time. Stock must stay live (D-05/D-06), so product/variant
// data is fetched on every page visit rather than baked into static HTML —
// this file intentionally has no build-time short-circuit; that pattern is
// specific to bandsintown.ts's build-time secret-hiding need and does not
// apply here.
//
// The base URL is read from VITE_API_URL (D-09) — a VITE_-prefixed var IS
// correct here (opposite of BANDSINTOWN_APP_ID): there is no secret to hide,
// only a public API base URL, which Vite inlines into the client bundle at
// build time. Falls back to the Render deployment URL when unset.

import type { Product } from '@bandplatform/shared'

const API = import.meta.env.VITE_API_URL ?? 'https://hurakan-band-platform.onrender.com'

/**
 * Fetch the full public product catalog. Mirrors Stock.tsx's res.ok-based
 * error handling (D-05); these endpoints are public (api/routes/products.js
 * GET routes), so no auth header / 401-403 branch is needed here.
 */
export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API}/api/products`)
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`)
  return res.json()
}

/**
 * Fetch a single public product by id.
 */
export async function fetchProduct(id: string): Promise<Product> {
  const res = await fetch(`${API}/api/products/${id}`)
  if (!res.ok) throw new Error(`Failed to load product (${res.status})`)
  return res.json()
}

/**
 * Fire-and-forget keep-alive ping (D-10). Warms the Render free-tier
 * instance out of cold-start on shop page load. Never throws — errors are
 * swallowed since this is a best-effort warm-up, not a data dependency.
 */
export function pingHealth(): void {
  fetch(`${API}/health`).catch(() => {})
}

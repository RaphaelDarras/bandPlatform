// Runtime-only (browser) authenticated inventory/admin client (D-09, D-17,
// D-27, D-29, D-30). The project's first authenticated web API client: every
// authenticated call the reworked /stock page makes goes through this one
// module, so the 401-and-403 "session expired" check is written exactly
// once instead of duplicated across each call site — the exact drift that
// produced the mobile app's apiClient bug recorded in STATE.md ([Phase
// 02-post]: the interceptor "only cleared auth on 401; backend returns 403
// for expired tokens").
//
// Mirrors web/src/lib/products.ts's API-base-URL-env-var + fallback
// convention (D-09) and web/src/lib/orders.ts's error-body unwrap
// convention. Unlike those two modules, every function here except
// loginAdmin sends a bearer auth header.

const API = import.meta.env.VITE_API_URL ?? 'https://hurakan-band-platform.onrender.com'

/**
 * D-30 (binding): thrown when an authenticated call receives a 401 or a 403.
 * The JWT is a hard 24h with no refresh endpoint (`/auth/verify` only
 * validates), so the ONLY permitted caller response is to clear the
 * sessionStorage token and re-render the login form. There is no
 * re-login-in-place, no token refresh, no dirty-form navigation guard, and
 * no unsaved-changes warning — anywhere. Do not add recovery UI here or in
 * any consumer.
 */
export class AuthExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthExpiredError'
  }
}

export interface StockVariant {
  sku: string
  size: string | null
  color: string | null
  stock: number
}

export interface StockProduct {
  productId: string
  name: string
  category: string | null
  active: boolean
  productTotal: number
  variants: StockVariant[]
}

export interface StockData {
  grandTotal: number
  productCount: number
  products: StockProduct[]
}

export interface BatchAdjustment {
  productId: string
  variantSku: string
  quantity: number
}

export interface BatchResult {
  productId: string
  variantSku: string
  stockBefore: number
  stockAfter: number
}

export interface VariantPayload {
  sku: string
  size?: string | null
  color?: string | null
  stock?: number
  priceAdjustment?: number
}

export interface CreateProductInput {
  name: string
  basePrice: number
  category?: string
  variants: VariantPayload[]
}

/**
 * Shared fetch wrapper for every authenticated call in this module. Owns the
 * base URL, the bearer header, and the D-30 401/403 contract in exactly one
 * place.
 */
async function authedFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })

  // D-30 (binding): the API returns 403 for an expired JWT, not only 401
  // (api/middleware/auth.js, expiresIn: '24h', absolute, no refresh route
  // exists). Both codes must throw here. The caller's only permitted
  // response is to clear the sessionStorage token and re-render the login
  // form: no retry, no re-login-in-place, no dirty-form guard, no
  // unsaved-changes prompt.
  if (res.status === 401 || res.status === 403) {
    throw new AuthExpiredError('Session expired')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }

  return res.json() as Promise<T>
}

/**
 * The ONLY unauthenticated call in this module. Preserves Stock.tsx's
 * current inline login behaviour byte-for-byte in semantics (D-29): parse
 * the body first, then check res.ok, so a non-ok response with an `error`
 * field still surfaces the server message. A wrong password is not an
 * expired session, so this never throws AuthExpiredError.
 */
export async function loginAdmin(username: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'Login failed')
  return body
}

/**
 * Fetches the full stock snapshot. The page fetches once with
 * includeInactive on and splits Active/Archived client-side.
 */
export async function fetchStock(token: string, includeInactive = true): Promise<StockData> {
  const query = includeInactive ? '?includeInactive=true' : ''
  return authedFetch<StockData>(`/api/inventory/stock${query}`, token)
}

export async function batchAdjustStock(
  token: string,
  adjustments: BatchAdjustment[],
): Promise<{ success: boolean; results: BatchResult[] }> {
  return authedFetch(`/api/inventory/restock/batch`, token, {
    method: 'POST',
    body: JSON.stringify({ adjustments }),
  })
}

export async function createProduct(token: string, input: CreateProductInput): Promise<unknown> {
  return authedFetch(`/api/products`, token, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * The single variant-writing wrapper. Serves both the add-variant flow and
 * the size/colour label edit.
 *
 * D-17 (footgun, intentional, documented rather than defended against): the
 * `variants` array passed here MUST be the FULL current variant list plus
 * any additions. `PUT /api/products/:id` `$pull`s every variant missing
 * from the payload, so passing a partial array silently DELETES the
 * omitted variants. This module does not guard against that — the caller
 * owns building the full array.
 */
export async function putProductVariants(
  token: string,
  productId: string,
  variants: VariantPayload[],
): Promise<unknown> {
  return authedFetch(`/api/products/${productId}`, token, {
    method: 'PUT',
    body: JSON.stringify({ variants }),
  })
}

/** Soft-delete: sets `active: false` on the product. */
export async function deactivateProduct(token: string, productId: string): Promise<unknown> {
  return authedFetch(`/api/products/${productId}`, token, {
    method: 'DELETE',
  })
}

/**
 * D-27: restore reuses PUT /api/products/:id's existing `active` whitelist
 * rather than a dedicated endpoint.
 */
export async function restoreProduct(token: string, productId: string): Promise<unknown> {
  return authedFetch(`/api/products/${productId}`, token, {
    method: 'PUT',
    body: JSON.stringify({ active: true }),
  })
}

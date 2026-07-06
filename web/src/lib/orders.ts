// Runtime-only (browser) orders client (D-02/D-05/D-09/D-10). Mirrors
// products.ts's fetch-in-lib pattern verbatim: same VITE_API_URL constant
// (falls back to the Render deployment URL), same `res.ok`-based error
// convention, and — like products.ts's public GET routes — NO Authorization
// header on either call below. Both `POST /api/orders` (guest checkout) and
// `POST /api/orders/paypal/capture` (browser-side PayPal capture, consumed
// by PaypalReturn.tsx in Plan 08) are public, unauthenticated routes.

import type { ShippingAddress, CreateOrderResponse } from '@bandplatform/shared'

const API = import.meta.env.VITE_API_URL ?? 'https://hurakan-band-platform.onrender.com'

export interface CreateOrderPayload {
  customerEmail: string
  customerName?: string
  items: { productId: string; variantSku: string; quantity: number }[]
  shippingAddress: ShippingAddress
  paymentMethod: 'stripe' | 'paypal'
}

/**
 * Create a guest order (SHOP-04/SHOP-05). Never sends price/total — the API
 * recomputes those server-side from the current catalog (D-06); the client
 * only supplies identifiers, quantities, and shipping details.
 */
export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResponse> {
  const res = await fetch(`${API}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to create order (${res.status})`)
  return res.json()
}

/**
 * Capture a PayPal order client-side (consumed by PaypalReturn.tsx, Plan 08)
 * after the customer approves payment on PayPal's hosted page.
 */
export async function capturePaypalOrder(paypalOrderId: string): Promise<{ status: string }> {
  const res = await fetch(`${API}/api/orders/paypal/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paypalOrderId }),
  })
  if (!res.ok) throw new Error(`Failed to capture PayPal order (${res.status})`)
  return res.json()
}

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

/**
 * Mirrors the platform API's Product variant sub-schema (see api/models/Product.js).
 */
export interface Variant {
  sku: string;
  size?: string;
  color?: string;
  stock: number;
  version: number;
  priceAdjustment: number;
}

/**
 * Mirrors the platform API's Product model (see api/models/Product.js).
 */
export interface Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  basePrice: number;
  images: string[];
  active: boolean;
  variants: Variant[];
}

/**
 * Mirrors the platform API's Order item sub-schema (see api/models/Order.js).
 * Not persisted/used at runtime this phase (D-01) — present for Phase 6 forward-compat (D-07).
 */
export interface OrderItem {
  productId: string;
  variantSku: string;
  quantity: number;
  priceAtPurchase: number;
}

/**
 * Mirrors the platform API's Order model (see api/models/Order.js).
 * Not persisted/used at runtime this phase (D-01) — present for Phase 6 forward-compat (D-07).
 */
export interface Order {
  orderNumber: string;
  customerEmail: string;
  customerName?: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'paid' | 'failed' | 'shipped' | 'delivered';
}

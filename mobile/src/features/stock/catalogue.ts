/**
 * Shared Shopify catalogue refresh (phase 07.1, D-20).
 * Fetches ACTIVE products from Shopify, merges pending shopify_stock ops,
 * upserts into the SQLite cache and prunes products no longer ACTIVE.
 */
import type * as SQLite from 'expo-sqlite';

import { fetchCatalogue, type ShopifyCatalogueProduct } from '@/api/shopify';
import {
  upsertProducts,
  reconcileActiveProducts,
  type CachedProduct,
} from '@/db/products';
import {
  SHOPIFY_STOCK,
  getAllPendingOutboxRows,
  type OutboxRow,
  type ShopifyStockPayload,
} from '@/db/outbox';

/** Per-variantGid stock delta (negative = not yet deducted in Shopify) from pending ops. */
export function computePendingStockDelta(rows: OutboxRow[]): Map<string, number> {
  const delta = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== SHOPIFY_STOCK) continue;
    let payload: ShopifyStockPayload;
    try {
      payload = JSON.parse(row.payload) as ShopifyStockPayload;
    } catch {
      continue;
    }
    if (!payload || typeof payload !== 'object' || !payload.variantGid) continue;
    let amount: number;
    if (payload.plan) {
      amount = payload.plan.delta;
    } else if (payload.kind === 'deduct' || payload.kind === 'unvoid') {
      amount = -payload.requested;
    } else {
      amount = payload.requested; // restock (signed) / restore
    }
    delta.set(payload.variantGid, (delta.get(payload.variantGid) ?? 0) + amount);
  }
  return delta;
}

/** Per-variant minimum of two pending-delta snapshots (missing = 0). */
export function minDelta(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    out.set(key, Math.min(a.get(key) ?? 0, b.get(key) ?? 0));
  }
  return out;
}

export function mapCatalogue(
  products: ShopifyCatalogueProduct[],
  pending: Map<string, number>
): CachedProduct[] {
  const now = Date.now();
  return products.map((p) => {
    const price = p.variants.length > 0 ? Math.min(...p.variants.map((v) => v.price)) : 0;
    return {
      id: p.productGid,
      name: p.name,
      price,
      imageUrl: p.imageUrl,
      active: 1,
      updatedAt: now,
      variants: p.variants.map((v) => ({
        variantGid: v.variantGid,
        sku: v.sku,
        label: v.label || v.sku,
        priceAdjustment: Math.round((v.price - price) * 100) / 100,
        stock: Math.max(0, v.available + (pending.get(v.variantGid) ?? 0)),
      })),
    };
  });
}

let inFlight: Promise<boolean> | null = null;

/**
 * Returns true when Shopify was fetched fully and the cache refreshed.
 * Single-flight (WR-04): concurrent callers (dashboard focus + full sync +
 * selling screen) share one fetch instead of each draining the cost bucket.
 */
export function refreshCatalogue(db: SQLite.SQLiteDatabase): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = doRefreshCatalogue(db).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRefreshCatalogue(db: SQLite.SQLiteDatabase): Promise<boolean> {
  try {
    // Snapshot pending ops on BOTH sides of the fetch (WR-05): an op that
    // applies in Shopify after it answered but before the second read would
    // otherwise be in neither `available` nor the pending delta. Keeping the
    // lower stock per variant errs toward not overselling.
    const before = computePendingStockDelta(await getAllPendingOutboxRows(db));
    const products = await fetchCatalogue();
    const after = computePendingStockDelta(await getAllPendingOutboxRows(db));
    const mapped = mapCatalogue(products, minDelta(before, after));
    if (mapped.length > 0) await upsertProducts(db, mapped);
    await reconcileActiveProducts(db, products.map((p) => p.productGid));
    return true;
  } catch (err: unknown) {
    console.error('[catalogue] Shopify fetch failed:', err instanceof Error ? err.message : String(err));
    return false;
  }
}

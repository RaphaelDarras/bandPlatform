/**
 * useStock — manages stock overview, cache refresh, and restock operations.
 *
 * Refresh: reads ACTIVE products from Shopify via refreshCatalogue (D-20) and
 * falls back to the local SQLite cache when offline.
 * Restock = Shopify +/- delta via the shopify_stock outbox, D-19 (works offline,
 * applied on next sync).
 */
import { useState, useCallback } from 'react';

import { getDb } from '@/db';
import { getCachedProducts, updateLocalStock, type CachedProduct } from '@/db/products';
import { insertOutboxEntries } from '@/db/outbox';
import { buildRestockEntry } from '@/db/stockOps';
import { runInTransaction } from '@/db/lock';
import { refreshCatalogue } from '@/features/stock/catalogue';
import { requestSync } from '@/features/sync/SyncManager';
import { apiClient } from '@/api/client';

export function useStock() {
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Refreshes the stock list from Shopify; SQLite cache is the final source
   * for the UI (offline fallback).
   */
  const refreshStock = useCallback(async () => {
    setLoading(true);
    const db = await getDb();
    await refreshCatalogue(db);

    try {
      const cached = await getCachedProducts(db);
      setProducts(cached);
    } catch {
      // Silently fail — UI will show empty list
    }

    setLoading(false);
  }, []);

  /**
   * Queues Shopify stock adjustments (positive restock or negative correction)
   * for several variants at once: every op and its optimistic cache update
   * commit in ONE transaction (all or nothing, so a retry after a failure can
   * never double-queue earlier variants - WR-09), then one sync and one
   * catalogue refresh.
   */
  const restockMany = useCallback(
    async (changes: { variantGid: string; delta: number }[], note: string): Promise<void> => {
      const nonZero = changes.filter((c) => c.delta !== 0);
      if (nonZero.length === 0) return;
      const db = await getDb();
      const now = Date.now();
      const entries = nonZero.map((c) => buildRestockEntry(c.variantGid, c.delta, note, now));

      await runInTransaction(db, async () => {
        await insertOutboxEntries(db, entries);
        const cached = await getCachedProducts(db);
        for (const c of nonZero) {
          const product = cached.find((p) => p.variants.some((v) => v.variantGid === c.variantGid));
          if (product) {
            await updateLocalStock(db, product.id, c.variantGid, c.delta);
          }
        }
      });

      void requestSync(db, apiClient);
      await refreshStock();
    },
    [refreshStock]
  );

  /** Single-variant convenience wrapper around restockMany. */
  const restock = useCallback(
    (variantGid: string, delta: number, note: string): Promise<void> =>
      restockMany([{ variantGid, delta }], note),
    [restockMany]
  );

  return {
    products,
    loading,
    refreshStock,
    restock,
    restockMany,
  };
}

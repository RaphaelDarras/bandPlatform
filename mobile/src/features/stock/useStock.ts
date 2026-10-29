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
   * Queues a Shopify stock adjustment (positive restock or negative correction),
   * updates the local cache optimistically and kicks the sync.
   */
  const restock = useCallback(
    async (variantGid: string, delta: number, note: string): Promise<void> => {
      if (delta === 0) return;
      const db = await getDb();
      const entry = buildRestockEntry(variantGid, delta, note, Date.now());
      await insertOutboxEntries(db, [entry]);

      const cached = await getCachedProducts(db);
      const product = cached.find((p) => p.variants.some((v) => v.variantGid === variantGid));
      if (product) {
        await updateLocalStock(db, product.id, variantGid, delta);
      }

      void requestSync(db, apiClient);
      await refreshStock();
    },
    [refreshStock]
  );

  return {
    products,
    loading,
    refreshStock,
    restock,
  };
}

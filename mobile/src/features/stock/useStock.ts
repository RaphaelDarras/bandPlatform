/**
 * useStock — manages stock overview, cache refresh, and restock operations.
 *
 * Online: fetches from API and upserts to local SQLite cache.
 * Offline: reads from local SQLite cache only.
 */
import { useState, useCallback } from 'react';

import { getDb } from '@/db';
import { getCachedProducts, upsertProducts, type CachedProduct } from '@/db/products';
import { getPendingOutboxRows } from '@/db/outbox';
import { apiGetStock, apiRestock } from '@/api/inventory';
import { apiGetProducts } from '@/api/products';
import { useAuthStore } from '@/stores/authStore';

export function useStock() {
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Refreshes the stock list.
   * Always attempts an API fetch first; falls back to SQLite cache on network failure.
   */
  const refreshStock = useCallback(async () => {
    setLoading(true);
    const db = await getDb();
    try {
      if (!useAuthStore.getState().token) throw new Error('not authenticated');
      const [stockProducts, priceProducts] = await Promise.all([
        apiGetStock(),
        apiGetProducts(),
      ]);

      // Build a per-variant delta from pending (unsynced) sale_create outbox rows.
      // These have been deducted locally but the backend hasn't received them yet.
      const pendingRows = await getPendingOutboxRows(db);
      const pendingDelta = new Map<string, number>();
      for (const row of pendingRows) {
        if (row.type !== 'sale_create') continue;
        const payload = JSON.parse(row.payload) as {
          items: Array<{ productId: string; variantSku: string; quantity: number }>;
        };
        for (const item of payload.items) {
          const key = `${item.productId}:${item.variantSku}`;
          pendingDelta.set(key, (pendingDelta.get(key) ?? 0) + item.quantity);
        }
      }

      // Baseline = API stock (reflects all synced sales + restocks).
      // Subtract only what the backend doesn't know about yet.
      const priceProductMap = new Map(priceProducts.map((p) => [p.id, p]));
      const merged = stockProducts.map((p) => {
        const apiProd = priceProductMap.get(p.id);
        const adjMap = new Map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (apiProd?.variants ?? []).map((v: any) => [v.sku, v.priceAdjustment ?? 0])
        );
        return {
          ...p,
          price: apiProd?.price ?? 0,
          variants: p.variants.map((v) => ({
            ...v,
            priceAdjustment: adjMap.get(v.sku) ?? 0,
            stock: v.stock - (pendingDelta.get(`${p.id}:${v.sku}`) ?? 0),
          })),
        };
      });
      if (merged.length > 0) {
        await upsertProducts(db, merged);
      }
    } catch (err: unknown) {
      console.error('[useStock] API fetch failed:', err instanceof Error ? err.message : String(err));
    }

    // Always read from SQLite as the final source of truth for the UI
    try {
      const cached = await getCachedProducts(db);
      setProducts(cached);
    } catch {
      // Silently fail — UI will show empty list
    }

    setLoading(false);
  }, []);

  /**
   * Restocks a product variant via the API, then refreshes local cache.
   * Requires internet connection.
   */
  const restock = useCallback(
    async (
      productId: string,
      variantSku: string,
      quantity: number,
      reason: string
    ): Promise<void> => {
      await apiRestock(productId, variantSku, quantity, reason);
      await refreshStock();
    },
    [refreshStock]
  );

  /**
   * Products with at least one variant having stock < 0.
   * These need to be reproduced/reordered.
   */
  const needsReproduction = products.filter((product) =>
    product.variants.some((v) => v.stock < 0)
  );

  return {
    products,
    loading,
    refreshStock,
    restock,
    needsReproduction,
  };
}

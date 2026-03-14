/**
 * useStock — manages stock overview, cache refresh, and restock operations.
 *
 * Online: fetches from API and upserts to local SQLite cache.
 * Offline: reads from local SQLite cache only.
 */
import { useState, useCallback } from 'react';

import { getDb } from '@/db';
import { getCachedProducts, upsertProducts, type CachedProduct } from '@/db/products';
import { apiGetStock, apiRestock } from '@/api/inventory';
import { useSyncStore } from '@/stores/syncStore';

export function useStock() {
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const { isOnline } = useSyncStore();

  /**
   * Refreshes the stock list.
   * When online: fetches from API and updates local cache.
   * When offline: reads from local SQLite cache.
   */
  const refreshStock = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDb();

      if (isOnline) {
        // Fetch fresh data from API
        const apiProducts = await apiGetStock();
        // Update local cache with API data
        if (apiProducts.length > 0) {
          await upsertProducts(db, apiProducts);
        }
      }

      // Always read from local cache as the source of truth
      const cached = await getCachedProducts(db);
      setProducts(cached);
    } catch (error) {
      // If API fails, fall back to local cache
      try {
        const db = await getDb();
        const cached = await getCachedProducts(db);
        setProducts(cached);
      } catch {
        // Silently fail — UI will show empty list
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

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

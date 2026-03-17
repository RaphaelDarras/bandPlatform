/**
 * useStock — manages stock overview, cache refresh, and restock operations.
 *
 * Online: fetches from API and upserts to local SQLite cache.
 * Offline: reads from local SQLite cache only.
 */
import { useState, useCallback } from 'react';

import { getDb } from '@/db';
import { getCachedProducts, upsertProducts, type CachedProduct, type ProductVariant } from '@/db/products';
import { apiGetStock, apiRestock } from '@/api/inventory';
import { apiGetProducts } from '@/api/products';
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
        const [stockProducts, priceProducts] = await Promise.all([
          apiGetStock(),
          apiGetProducts(),
        ]);
        // Preserve local stock — the outbox may have unsynced sales that the API doesn't know about yet
        const localProducts = await getCachedProducts(db);
        const localStockMap = new Map<string, number>(
          localProducts.flatMap((p) => p.variants.map((v: ProductVariant) => [`${p.id}:${v.sku}`, v.stock] as [string, number]))
        );
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
              // Use local stock for known variants; fall back to API for new variants
              stock: localStockMap.get(`${p.id}:${v.sku}`) ?? v.stock,
            })),
          };
        });
        if (merged.length > 0) {
          await upsertProducts(db, merged);
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

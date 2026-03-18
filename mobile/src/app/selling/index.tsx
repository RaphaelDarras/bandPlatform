import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDb } from '@/db';
import { getCachedProducts, upsertProducts } from '@/db/products';
import { getPendingOutboxRows } from '@/db/outbox';
import type { CachedProduct } from '@/db/products';
import { apiGetProducts } from '@/api/products';
import { ProductGrid } from '@/features/catalog/ProductGrid';

/**
 * Selling index screen — shows the product grid.
 * - Loads products from local SQLite cache
 * - If no cached products and offline: shows a message
 * - Pull-to-refresh reloads from cache (API sync driven by separate background job)
 */
export default function SellingScreen() {
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const db = await getDb();
      let fetchedFromApi = false;

      try {
        const apiProducts = await apiGetProducts();
        if (apiProducts.length > 0) {
          fetchedFromApi = true;
          // Build pending delta from unsynced sale_create outbox rows.
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

          await upsertProducts(db, apiProducts.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            imageUrl: p.imageUrl ?? null,
            active: 1 as const,
            updatedAt: Date.now(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            variants: (p.variants as any[]).map((v) => ({
              sku: v.sku,
              label: v.label || [v.size, v.color].filter(Boolean).join(' / ') || v.sku,
              priceAdjustment: v.priceAdjustment ?? 0,
              stock: (v.stock ?? 0) - (pendingDelta.get(`${p.id}:${v.sku}`) ?? 0),
            })),
          })));
        }
      } catch {
        // Network unavailable — fall through to cache
      }

      const cached = await getCachedProducts(db);
      setProducts(cached);
      setIsOffline(!fetchedFromApi && cached.length === 0);
    } catch (err) {
      console.error('[SellingScreen] Failed to load products:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadProducts().finally(() => setLoading(false));
    }, [loadProducts])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  }, [loadProducts]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  if (products.length === 0 && isOffline) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.offlineIcon}>{'📵'}</Text>
          <Text style={styles.offlineTitle}>No products cached</Text>
          <Text style={styles.offlineMessage}>
            Connect to the internet to load the product catalog.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ProductGrid
        products={products}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
  },
  offlineIcon: {
    fontSize: 40,
  },
  offlineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  offlineMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

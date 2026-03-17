import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

import { getDb } from '@/db';
import { getCachedProducts, upsertProducts } from '@/db/products';
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
      const netState = await NetInfo.fetch();
      const online = !!(netState.isConnected && netState.isInternetReachable);

      if (online) {
        try {
          const apiProducts = await apiGetProducts();
          if (apiProducts.length > 0) {
            // Preserve local stock — only the sync manager should update stock from the server.
            // The selling screen only needs catalog data (name, price, variants metadata).
            const localProducts = await getCachedProducts(db);
            const localStockMap = new Map(
              localProducts.flatMap((p) => p.variants.map((v) => [`${p.id}:${v.sku}`, v.stock]))
            );
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
                // Use local stock if available, fall back to API stock for new products
                stock: localStockMap.get(`${p.id}:${v.sku}`) ?? v.stock ?? 0,
              })),
            })));
          }
        } catch {
          // API unavailable — fall through to cache
        }
      }

      const cached = await getCachedProducts(db);
      setProducts(cached);
      setIsOffline(!online && cached.length === 0);
    } catch (err) {
      console.error('[SellingScreen] Failed to load products:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadProducts().finally(() => setLoading(false));
  }, [loadProducts]);

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

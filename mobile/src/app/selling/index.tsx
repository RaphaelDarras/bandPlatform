import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { getDb } from '@/db';
import { getCachedProducts } from '@/db/products';
import { getConcertPriceOverrides } from '@/db/concerts';
import type { CachedProduct } from '@/db/products';
import { refreshCatalogue } from '@/features/stock/catalogue';
import { useCartStore } from '@/stores/cartStore';
import { ProductGrid } from '@/features/catalog/ProductGrid';

/**
 * Selling index screen — shows the product grid.
 * - Catalogue comes from Shopify (ACTIVE products) via refreshCatalogue, cached in SQLite
 * - If no cached products and offline: shows a message
 * - Pull-to-refresh and focus re-fetch from Shopify, falling back to the cache offline
 */
export default function SellingScreen() {
  const c = useTheme();
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const db = await getDb();
      const fetchedFromApi = await refreshCatalogue(db);

      let cached = await getCachedProducts(db);

      // Apply concert price overrides if selling for a specific concert
      const concertId = useCartStore.getState().concertId;
      if (concertId) {
        const overrides = await getConcertPriceOverrides(db, concertId);
        if (overrides.length > 0) {
          const overrideMap = new Map(overrides.map((ov) => [ov.product_id, ov.price]));
          cached = cached.map((p) => {
            const overridePrice = overrideMap.get(p.id);
            return overridePrice !== undefined
              ? { ...p, price: overridePrice, originalPrice: p.price }
              : { ...p, originalPrice: p.price };
          });
        }
      }

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
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <Text style={[styles.loadingText, { color: c.textSecondary }]}>Loading products...</Text>
      </View>
    );
  }

  if (products.length === 0 && isOffline) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.offlineIcon}>{'📵'}</Text>
          <Text style={[styles.offlineTitle, { color: c.text }]}>No products cached</Text>
          <Text style={[styles.offlineMessage, { color: c.textSecondary }]}>
            Connect to the internet to load the product catalog.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['bottom']}>
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

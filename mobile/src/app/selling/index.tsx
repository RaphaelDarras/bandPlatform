import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

import { getDb } from '@/db';
import { getCachedProducts } from '@/db/products';
import type { CachedProduct } from '@/db/products';
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
      const cached = await getCachedProducts(db);
      setProducts(cached);

      if (cached.length === 0) {
        const netState = await NetInfo.fetch();
        setIsOffline(!netState.isConnected);
      }
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

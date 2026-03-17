/**
 * Product management screen — list of all products.
 * Requires internet (product changes not queued offline).
 */
import React, { useState, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiGetProducts, type ApiProduct } from '@/api/products';
import { useSyncStore } from '@/stores/syncStore';

function ProductItem({ product, onPress }: { product: ApiProduct; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.productItem, pressed && { opacity: 0.8 }]}
      onPress={onPress}
      accessibilityLabel={`Edit ${product.name}`}
    >
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productMeta}>
          €{product.price.toFixed(2)} · {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.productRight}>
        {!product.active && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Inactive</Text>
          </View>
        )}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

export default function ProductsIndexScreen() {
  const { isOnline } = useSyncStore();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const data = await apiGetProducts();
      setProducts(data);
    } catch {
      Alert.alert('Error', 'Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  if (!isOnline) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Products</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.offlineState}>
          <Text style={styles.offlineIcon}>📵</Text>
          <Text style={styles.offlineTitle}>Internet Required</Text>
          <Text style={styles.offlineSubtext}>
            Product management requires an internet connection.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Products</Text>
        <Pressable
          onPress={() => router.push('/products/new' as never)}
          style={styles.addButtonWrapper}
          accessibilityLabel="Add new product"
        >
          {({ pressed }) => (
            <View style={[styles.addButton, pressed && { opacity: 0.85 }]}>
              <Text style={styles.addButtonText}>+</Text>
            </View>
          )}
        </Pressable>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductItem
            product={item}
            onPress={() => router.push(`/products/${item.id}` as never)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadProducts} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No products yet</Text>
              <Pressable
                style={styles.createFirstButton}
                onPress={() => router.push('/products/new' as never)}
              >
                <Text style={styles.createFirstText}>Create your first product</Text>
              </Pressable>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { width: 60 },
  backText: { color: '#208AEF', fontSize: 15 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  addButtonWrapper: { borderRadius: 18, overflow: 'hidden' },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  listContent: { padding: 12 },
  productItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  productMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  productRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inactiveBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inactiveBadgeText: { fontSize: 11, color: '#92400e', fontWeight: '600' },
  chevron: { fontSize: 20, color: '#ccc' },
  offlineState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  offlineIcon: { fontSize: 48, marginBottom: 16 },
  offlineTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  offlineSubtext: { fontSize: 14, color: '#666', textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, color: '#666' },
  createFirstButton: { marginTop: 12, padding: 12 },
  createFirstText: { color: '#208AEF', fontSize: 14, fontWeight: '600' },
});

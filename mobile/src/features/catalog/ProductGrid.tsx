import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { CachedProduct } from '@/db/products';
import { ProductTile } from './ProductTile';

interface Props {
  products: CachedProduct[];
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * ProductGrid renders a 2-column grid of product tiles.
 * Supports pull-to-refresh to reload from SQLite/API.
 */
export function ProductGrid({ products, onRefresh, refreshing }: Props) {
  if (products.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No products available.</Text>
        <Text style={styles.emptySubtext}>Pull to refresh or connect to load catalog.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      numColumns={2}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ProductTile product={item} />}
      onRefresh={onRefresh}
      refreshing={refreshing}
      contentContainerStyle={styles.content}
      columnWrapperStyle={styles.row}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 6,
    paddingBottom: 100, // space for CartBar
  },
  row: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

/**
 * Stock overview screen.
 * Expandable product rows: collapsed shows product name + total stock.
 * Expanded shows per-variant breakdown (SKU, label, individual stock count).
 * Pull-to-refresh + auto-refresh on screen focus.
 * "Needs Reproduction" section for items with negative stock.
 */
import React, { useState, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStock } from '@/features/stock/useStock';
import { useTheme } from '@/hooks/use-theme';
import type { CachedProduct } from '@/db/products';
import { stockColor } from '@/utils/stockColor';

function ProductRow({ product }: { product: CachedProduct }) {
  const [expanded, setExpanded] = useState(false);
  const c = useTheme();

  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const minStock = Math.min(...product.variants.map((v) => v.stock));

  return (
    <Pressable
      style={[styles.productRow, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}
      onPress={() => setExpanded((prev) => !prev)}
      accessibilityLabel={`${product.name} ${totalStock} in stock`}
    >
      <View style={styles.productHeader}>
        <Text style={[styles.productName, { color: c.text }]}>{product.name}</Text>
        <View style={[styles.stockBadge, { backgroundColor: c.badgeBg }]}>
          <Text style={[styles.stockBadgeText, { color: stockColor(minStock) }]}>{totalStock}</Text>
        </View>
      </View>
      <Text style={[styles.expandHint, { color: c.textSecondary }]}>{expanded ? '▲ Hide variants' : '▼ Show variants'}</Text>

      {expanded && (
        <View style={[styles.variantList, { borderTopColor: c.border }]}>
          {product.variants.map((variant) => (
            <View key={variant.sku} style={styles.variantRow}>
              <Text style={[styles.variantLabel, { color: c.text }]}>{variant.label}</Text>
              <Text style={[styles.variantStock, { color: stockColor(variant.stock) }]}>{variant.stock}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

export default function StockScreen() {
  const { t } = useTranslation();
  const { products, loading, refreshStock, needsReproduction } = useStock();
  const c = useTheme();

  // Auto-refresh when screen gains focus
  useFocusEffect(
    useCallback(() => {
      refreshStock();
    }, [refreshStock])
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.headerBg, borderBottomColor: c.border }]}>
        <Text style={[styles.headerTitle, { color: c.text }]}>{t('tabs.stock')}</Text>
        <Pressable
          style={[styles.restockButton, { backgroundColor: c.accent }]}
          onPress={() => router.push('/restock' as never)}
          accessibilityLabel="Restock products"
        >
          <Text style={styles.restockButtonText}>Restock</Text>
        </Pressable>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductRow product={item} />}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refreshStock} />
        }
        ListHeaderComponent={
          needsReproduction.length > 0 ? (
            <View style={[styles.deficitSection, { backgroundColor: 'rgba(255, 245, 245, 0.15)', borderColor: c.danger }]}>
              <View style={styles.deficitHeader}>
                <Text style={[styles.deficitTitle, { color: c.danger }]}>Needs Reproduction</Text>
                <View style={[styles.deficitBadge, { backgroundColor: c.danger }]}>
                  <Text style={styles.deficitBadgeText}>{needsReproduction.length}</Text>
                </View>
              </View>
              {needsReproduction.map((product) => {
                const deficitVariants = product.variants.filter((v) => v.stock <= 0);
                return (
                  <View key={product.id} style={styles.deficitItem}>
                    <Text style={[styles.deficitProductName, { color: c.text }]}>{product.name}</Text>
                    {deficitVariants.map((v) => (
                      <Text key={v.sku} style={[styles.deficitVariantText, { color: c.danger }]}>
                        {v.label}: {v.stock}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>No products found</Text>
              <Text style={[styles.emptySubtext, { color: c.textSecondary }]}>Pull to refresh or go online to sync</Text>
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  restockButton: {
    backgroundColor: '#208AEF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  restockButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  listContent: { padding: 12, gap: 8 },
  productRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 8,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  stockBadge: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  stockBadgeText: { fontSize: 14, fontWeight: '700', color: '#1a73e8' },
  expandHint: { fontSize: 11, color: '#aaa', marginTop: 4 },
  variantList: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 8 },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  variantSku: { fontSize: 12, color: '#666', width: 80, fontFamily: 'monospace' },
  variantLabel: { fontSize: 13, color: '#444', flex: 1 },
  variantStock: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', width: 40, textAlign: 'right' },
  deficitSection: {
    backgroundColor: '#fff5f5',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deficitHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  deficitTitle: { fontSize: 15, fontWeight: '700', color: '#dc2626' },
  deficitBadge: {
    backgroundColor: '#dc2626',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deficitBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  deficitItem: { marginBottom: 8 },
  deficitProductName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  deficitVariantText: { fontSize: 12, color: '#dc2626', marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, color: '#666', fontWeight: '500' },
  emptySubtext: { fontSize: 13, color: '#aaa', marginTop: 4 },
});

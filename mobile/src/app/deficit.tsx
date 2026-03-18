/**
 * Deficit screen — products with negative stock.
 * Shows each negative variant and how many units need to be reproduced.
 */
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStock } from '@/features/stock/useStock';

export default function DeficitScreen() {
  const { needsReproduction, loading, refreshStock } = useStock();

  useEffect(() => {
    refreshStock();
  }, [refreshStock]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Needs Restock</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshStock} />}
      >
        {needsReproduction.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'✅'}</Text>
            <Text style={styles.emptyTitle}>All good</Text>
            <Text style={styles.emptySubtitle}>No items have negative stock.</Text>
          </View>
        ) : (
          needsReproduction.map((product) => {
            const negativeVariants = product.variants.filter((v) => v.stock < 0);
            return (
              <View key={product.id} style={styles.card}>
                <Text style={styles.productName}>{product.name}</Text>
                {negativeVariants.map((v) => (
                  <View key={v.sku} style={styles.variantRow}>
                    <View style={styles.variantInfo}>
                      <Text style={styles.variantLabel}>{v.label}</Text>
                      <Text style={styles.variantSku}>{v.sku}</Text>
                    </View>
                    <View style={styles.variantNumbers}>
                      <Text style={styles.currentStock}>{v.stock}</Text>
                      <Text style={styles.toReproduce}>
                        {`Reproduce ${Math.abs(v.stock)}`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
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
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  emptySubtitle: { fontSize: 14, color: '#888' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  variantInfo: { gap: 2 },
  variantLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  variantSku: { fontSize: 11, color: '#aaa' },
  variantNumbers: { alignItems: 'flex-end', gap: 2 },
  currentStock: { fontSize: 16, fontWeight: '800', color: '#ef4444' },
  toReproduce: { fontSize: 12, fontWeight: '600', color: '#f59e0b' },
});

/**
 * Stock Adjustment screen — add or remove units per variant.
 * Select product → adjust each variant inline with +/- → optional reason → confirm.
 * Requires internet connection.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStock } from '@/features/stock/useStock';
import { useTheme } from '@/hooks/use-theme';
import { useSyncStore } from '@/stores/syncStore';
import type { CachedProduct } from '@/db/products';
import { stockColor } from '@/utils/stockColor';

export default function RestockScreen() {
  const { products, loading, refreshStock, restock } = useStock();
  const { isOnline } = useSyncStore();
  const c = useTheme();

  const [selectedProduct, setSelectedProduct] = useState<CachedProduct | null>(null);
  // quantities[sku] = current displayed quantity (starts at variant.stock)
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshStock();
  }, [refreshStock]);

  const handleProductSelect = useCallback((product: CachedProduct) => {
    setSelectedProduct(product);
    const initial: Record<string, number> = {};
    for (const v of product.variants) {
      initial[v.sku] = v.stock;
    }
    setQuantities(initial);
    setReason('');
  }, []);

  const adjust = useCallback((sku: string, by: number) => {
    setQuantities((prev) => ({ ...prev, [sku]: (prev[sku] ?? 0) + by }));
  }, []);

  const hasChanges = selectedProduct?.variants.some(
    (v) => (quantities[v.sku] ?? v.stock) !== v.stock
  ) ?? false;

  const handleConfirm = useCallback(async () => {
    if (!selectedProduct || !hasChanges) return;
    setSubmitting(true);
    try {
      for (const variant of selectedProduct.variants) {
        const delta = (quantities[variant.sku] ?? variant.stock) - variant.stock;
        if (delta !== 0) {
          await restock(selectedProduct.id, variant.sku, delta, reason);
        }
      }
      Alert.alert('Stock Updated', `${selectedProduct.name} stock has been adjusted.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Failed', 'Unable to update stock. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [selectedProduct, quantities, hasChanges, reason, restock]);

  if (!isOnline) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={[styles.header, { backgroundColor: c.headerBg, borderBottomColor: c.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: c.accent }]}>← Back</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: c.text }]}>Stock Adjustment</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.offlineState}>
          <Text style={styles.offlineIcon}>📵</Text>
          <Text style={[styles.offlineTitle, { color: c.text }]}>Internet Required</Text>
          <Text style={[styles.offlineSubtext, { color: c.textSecondary }]}>
            Stock adjustments require an internet connection. Please connect and try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { backgroundColor: c.headerBg, borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: c.accent }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]}>Stock Adjustment</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Step 1: Select Product */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>1. Select Product</Text>
          {loading ? (
            <Text style={[styles.loadingText, { color: c.textSecondary }]}>Loading products...</Text>
          ) : (
            products.map((product) => (
              <Pressable
                key={product.id}
                style={[
                  styles.selectItem,
                  { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder },
                  selectedProduct?.id === product.id && styles.selectItemActive,
                ]}
                onPress={() => handleProductSelect(product)}
              >
                <Text
                  style={[
                    styles.selectItemText,
                    { color: c.text },
                    selectedProduct?.id === product.id && styles.selectItemTextActive,
                  ]}
                >
                  {product.name}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        {/* Step 2: Adjust variants inline */}
        {selectedProduct && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>2. Adjust Quantities</Text>
            <View style={[styles.variantsCard, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
              {selectedProduct.variants.map((variant, index) => {
                const qty = quantities[variant.sku] ?? variant.stock;
                const delta = qty - variant.stock;
                const isLast = index === selectedProduct.variants.length - 1;
                return (
                  <View
                    key={variant.sku}
                    style={[styles.variantRow, !isLast && styles.variantRowBorder, !isLast && { borderBottomColor: c.border }]}
                  >
                    <View style={styles.variantInfo}>
                      <Text style={[styles.variantLabel, { color: c.text }]}>
                        {variant.label}
                        <Text style={{ color: stockColor(variant.stock), fontSize: 12 }}> (stock: {variant.stock})</Text>
                      </Text>
                      {delta !== 0 && (
                        <Text style={[
                          styles.variantDelta,
                          delta > 0 ? styles.deltaPositive : styles.deltaNegative,
                        ]}>
                          {delta > 0 ? `+${delta}` : delta}
                        </Text>
                      )}
                    </View>
                    <View style={styles.stepper}>
                      <Pressable
                        style={({ pressed }) => [styles.stepBtn, { backgroundColor: c.backgroundElement }, pressed && styles.stepBtnPressed]}
                        onPress={() => adjust(variant.sku, -1)}
                        accessibilityLabel={`Decrease ${variant.label}`}
                      >
                        <Text style={[styles.stepBtnText, { color: c.text }]}>−</Text>
                      </Pressable>
                      <Text style={[
                        styles.stepQty,
                        { color: c.text },
                        delta > 0 && styles.deltaPositive,
                        delta < 0 && styles.deltaNegative,
                      ]}>
                        {qty}
                      </Text>
                      <Pressable
                        style={({ pressed }) => [styles.stepBtn, { backgroundColor: c.backgroundElement }, pressed && styles.stepBtnPressed]}
                        onPress={() => adjust(variant.sku, 1)}
                        accessibilityLabel={`Increase ${variant.label}`}
                      >
                        <Text style={[styles.stepBtnText, { color: c.text }]}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 3: Optional Reason */}
        {hasChanges && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>3. Reason (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Concert restock, damaged goods, inventory correction..."
              placeholderTextColor={c.textSecondary}
              multiline
              numberOfLines={3}
              accessibilityLabel="Adjustment reason"
            />
          </View>
        )}

        {/* Confirm */}
        {hasChanges && (
          <Pressable
            style={[styles.confirmButton, { backgroundColor: c.accent }, submitting && { backgroundColor: c.backgroundElement }]}
            onPress={handleConfirm}
            disabled={submitting}
            accessibilityLabel="Confirm adjustment"
          >
            <Text style={styles.confirmButtonText}>
              {submitting ? 'Processing...' : 'Confirm Adjustment'}
            </Text>
          </Pressable>
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
  content: { padding: 16, gap: 20 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 4 },
  selectItem: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
  },
  selectItemActive: { borderColor: '#208AEF', backgroundColor: '#e8f4ff' },
  selectItemText: { fontSize: 14, color: '#333' },
  selectItemTextActive: { color: '#208AEF', fontWeight: '600' },
  loadingText: { fontSize: 14, color: '#888' },
  variantsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  variantRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  variantInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  variantLabel: { fontSize: 14, color: '#333', fontWeight: '500' },
  variantDelta: { fontSize: 12, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: { opacity: 0.6 },
  stepBtnText: { fontSize: 20, fontWeight: '400', color: '#1a1a1a', lineHeight: 22 },
  stepQty: { width: 40, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  deltaPositive: { color: '#16a34a' },
  deltaNegative: { color: '#ef4444' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1a1a1a',
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  confirmButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmButtonDisabled: { opacity: 0.5 },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  offlineState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  offlineIcon: { fontSize: 48, marginBottom: 16 },
  offlineTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  offlineSubtext: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
});

/**
 * Restock screen — separate from stock overview to prevent misclicks.
 * Step-by-step: select product → select variant → enter quantity → optional reason → confirm.
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
import { useSyncStore } from '@/stores/syncStore';
import type { CachedProduct, ProductVariant } from '@/db/products';

export default function RestockScreen() {
  const { products, loading, refreshStock, restock } = useStock();
  const { isOnline } = useSyncStore();

  const [selectedProduct, setSelectedProduct] = useState<CachedProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshStock();
  }, [refreshStock]);

  const handleProductSelect = useCallback((product: CachedProduct) => {
    setSelectedProduct(product);
    setSelectedVariant(null);
  }, []);

  const handleVariantSelect = useCallback((variant: ProductVariant) => {
    setSelectedVariant(variant);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedProduct || !selectedVariant) return;
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      await restock(selectedProduct.id, selectedVariant.sku, qty, reason);
      Alert.alert('Restocked', `Added ${qty} units of ${selectedVariant.label} to ${selectedProduct.name}.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Restock Failed', 'Unable to restock. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [selectedProduct, selectedVariant, quantity, reason, restock]);

  if (!isOnline) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Restock</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.offlineState}>
          <Text style={styles.offlineIcon}>📵</Text>
          <Text style={styles.offlineTitle}>Internet Required</Text>
          <Text style={styles.offlineSubtext}>
            Restock requires an internet connection. Please connect and try again.
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
        <Text style={styles.headerTitle}>Restock</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Step 1: Select Product */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Select Product</Text>
          {loading ? (
            <Text style={styles.loadingText}>Loading products...</Text>
          ) : (
            products.map((product) => (
              <Pressable
                key={product.id}
                style={[
                  styles.selectItem,
                  selectedProduct?.id === product.id && styles.selectItemActive,
                ]}
                onPress={() => handleProductSelect(product)}
              >
                <Text
                  style={[
                    styles.selectItemText,
                    selectedProduct?.id === product.id && styles.selectItemTextActive,
                  ]}
                >
                  {product.name}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        {/* Step 2: Select Variant */}
        {selectedProduct && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Select Variant</Text>
            {selectedProduct.variants.map((variant) => (
              <Pressable
                key={variant.sku}
                style={[
                  styles.selectItem,
                  selectedVariant?.sku === variant.sku && styles.selectItemActive,
                ]}
                onPress={() => handleVariantSelect(variant)}
              >
                <Text
                  style={[
                    styles.selectItemText,
                    selectedVariant?.sku === variant.sku && styles.selectItemTextActive,
                  ]}
                >
                  {variant.label} ({variant.sku}) — {variant.stock} in stock
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Step 3: Enter Quantity */}
        {selectedVariant && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Quantity to Add</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="Enter quantity"
              keyboardType="number-pad"
              accessibilityLabel="Restock quantity"
            />
          </View>
        )}

        {/* Step 4: Optional Reason */}
        {selectedVariant && quantity ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Reason (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Concert restock, online order fulfillment..."
              multiline
              numberOfLines={3}
              accessibilityLabel="Restock reason"
            />
          </View>
        ) : null}

        {/* Confirm */}
        {selectedProduct && selectedVariant && quantity ? (
          <Pressable
            style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={submitting}
            accessibilityLabel="Confirm Restock"
          >
            <Text style={styles.confirmButtonText}>
              {submitting ? 'Processing...' : 'Confirm Restock'}
            </Text>
          </Pressable>
        ) : null}
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
  selectItemActive: {
    borderColor: '#208AEF',
    backgroundColor: '#e8f4ff',
  },
  selectItemText: { fontSize: 14, color: '#333' },
  selectItemTextActive: { color: '#208AEF', fontWeight: '600' },
  loadingText: { fontSize: 14, color: '#888' },
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
  confirmButtonDisabled: { backgroundColor: '#93c5fd' },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  offlineState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  offlineIcon: { fontSize: 48, marginBottom: 16 },
  offlineTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  offlineSubtext: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
});

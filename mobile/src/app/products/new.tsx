/**
 * New product form.
 * Fields: name, price, variants (dynamic add/remove), image URL.
 * Requires internet connection.
 */
import React, { useState } from 'react';
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

import { useTheme } from '@/hooks/use-theme';
import { apiCreateProduct, type ApiProductVariant } from '@/api/products';
import { useSyncStore } from '@/stores/syncStore';

interface VariantDraft {
  key: string; // local key for list rendering
  sku: string;
  label: string;
  size: string;
  color: string;
}

function makeVariantDraft(): VariantDraft {
  return { key: `v-${Date.now()}-${Math.random()}`, sku: '', label: '', size: '', color: '' };
}

export default function NewProductScreen() {
  const c = useTheme();
  const { isOnline } = useSyncStore();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [variants, setVariants] = useState<VariantDraft[]>([makeVariantDraft()]);
  const [submitting, setSubmitting] = useState(false);

  const addVariant = () => setVariants((prev) => [...prev, makeVariantDraft()]);

  const removeVariant = (key: string) =>
    setVariants((prev) => prev.filter((v) => v.key !== key));

  const updateVariant = (key: string, field: keyof Omit<VariantDraft, 'key'>, value: string) =>
    setVariants((prev) =>
      prev.map((v) => (v.key === key ? { ...v, [field]: value } : v))
    );

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Product name is required.');
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }

    const validVariants = variants.filter((v) => v.sku.trim());
    if (validVariants.length === 0) {
      Alert.alert('Missing SKU', 'At least one variant with a SKU is required.');
      return;
    }

    const variantData: Omit<ApiProductVariant, 'stock'>[] = validVariants.map((v) => ({
      sku: v.sku.trim().toUpperCase(),
      label: v.label.trim() || [v.size, v.color].filter(Boolean).join(' / ') || v.sku,
      size: v.size.trim() || undefined,
      color: v.color.trim() || undefined,
      priceAdjustment: 0,
    }));

    setSubmitting(true);
    try {
      await apiCreateProduct({
        name: name.trim(),
        price: priceNum,
        imageUrl: imageUrl.trim() || null,
        variants: variantData,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to create product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOnline) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={[styles.header, { backgroundColor: c.headerBg, borderBottomColor: c.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: c.accent }]}>← Back</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: c.text }]}>New Product</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.offlineState}>
          <Text style={styles.offlineIcon}>📵</Text>
          <Text style={[styles.offlineTitle, { color: c.text }]}>Internet Required</Text>
          <Text style={[styles.offlineSubtext, { color: c.textSecondary }]}>Creating products requires an internet connection.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { backgroundColor: c.headerBg, borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: c.accent }]}>← Cancel</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]}>New Product</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Product Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Product Info</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
            value={name}
            onChangeText={setName}
            placeholder="Product name *"
            placeholderTextColor={c.textSecondary}
            accessibilityLabel="Product name"
          />
          <TextInput
            style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
            value={price}
            onChangeText={setPrice}
            placeholder="Base price (e.g. 25.00) *"
            placeholderTextColor={c.textSecondary}
            keyboardType="decimal-pad"
            accessibilityLabel="Product price"
          />
          <TextInput
            style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="Image URL (optional)"
            placeholderTextColor={c.textSecondary}
            keyboardType="url"
            autoCapitalize="none"
            accessibilityLabel="Product image URL"
          />
        </View>

        {/* Variants */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Variants</Text>
            <Pressable onPress={addVariant} style={styles.addVariantButton}>
              <Text style={styles.addVariantText}>+ Add Variant</Text>
            </Pressable>
          </View>

          {variants.map((variant, idx) => (
            <View key={variant.key} style={[styles.variantCard, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
              <View style={styles.variantCardHeader}>
                <Text style={[styles.variantCardTitle, { color: c.accent }]}>Variant {idx + 1}</Text>
                {variants.length > 1 && (
                  <Pressable onPress={() => removeVariant(variant.key)}>
                    <Text style={[styles.removeText, { color: c.danger }]}>Remove</Text>
                  </Pressable>
                )}
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
                value={variant.sku}
                onChangeText={(v) => updateVariant(variant.key, 'sku', v)}
                placeholder="SKU *"
                placeholderTextColor={c.textSecondary}
                autoCapitalize="characters"
                accessibilityLabel={`Variant ${idx + 1} SKU`}
              />
              <TextInput
                style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
                value={variant.label}
                onChangeText={(v) => updateVariant(variant.key, 'label', v)}
                placeholder="Display label (e.g. Small, Red/M)"
                placeholderTextColor={c.textSecondary}
                accessibilityLabel={`Variant ${idx + 1} label`}
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
                  value={variant.size}
                  onChangeText={(v) => updateVariant(variant.key, 'size', v)}
                  placeholder="Size (e.g. M, L)"
                  placeholderTextColor={c.textSecondary}
                  accessibilityLabel={`Variant ${idx + 1} size`}
                />
                <TextInput
                  style={[styles.input, styles.halfInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
                  value={variant.color}
                  onChangeText={(v) => updateVariant(variant.key, 'color', v)}
                  placeholder="Color (e.g. Blue)"
                  placeholderTextColor={c.textSecondary}
                  accessibilityLabel={`Variant ${idx + 1} color`}
                />
              </View>
            </View>
          ))}
        </View>

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityLabel="Create product"
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Creating...' : 'Create Product'}
          </Text>
        </Pressable>
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
  backButton: { width: 70 },
  backText: { color: '#208AEF', fontSize: 15 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  row: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  variantCard: {
    backgroundColor: '#f0f7ff',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#cce5ff',
  },
  variantCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  variantCardTitle: { fontSize: 13, fontWeight: '600', color: '#1a73e8' },
  removeText: { color: '#ef4444', fontSize: 13 },
  addVariantButton: {
    backgroundColor: '#208AEF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addVariantText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  submitButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: { backgroundColor: '#93c5fd' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  offlineState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  offlineIcon: { fontSize: 48, marginBottom: 16 },
  offlineTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  offlineSubtext: { fontSize: 14, color: '#666', textAlign: 'center' },
});

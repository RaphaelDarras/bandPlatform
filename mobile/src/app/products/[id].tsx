/**
 * Edit product screen.
 * Pre-populated form with existing product data.
 * Includes Deactivate button (soft delete).
 * Requires internet connection.
 */
import React, { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
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

import {
  apiGetProducts,
  apiUpdateProduct,
  apiDeactivateProduct,
  type ApiProduct,
  type ApiProductVariant,
} from '@/api/products';
import { useSyncStore } from '@/stores/syncStore';

interface VariantDraft {
  key: string;
  sku: string;
  label: string;
  size: string;
  color: string;
}

function productToVariantDrafts(variants: ApiProductVariant[]): VariantDraft[] {
  return variants.map((v, idx) => ({
    key: `v-${idx}-${v.sku}`,
    sku: v.sku,
    label: v.label || [v.size, v.color].filter(Boolean).join(' / ') || '',
    size: v.size ?? '',
    color: v.color ?? '',
  }));
}

function makeVariantDraft(): VariantDraft {
  return { key: `v-${Date.now()}-${Math.random()}`, sku: '', label: '', size: '', color: '' };
}

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isOnline } = useSyncStore();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOnline || !id) return;
    const load = async () => {
      try {
        const products = await apiGetProducts();
        const found = products.find((p) => p.id === id);
        if (found) {
          setProduct(found);
          setName(found.name);
          setPrice(String(found.price));
          setImageUrl(found.imageUrl ?? '');
          setVariants(productToVariantDrafts(found.variants));
        }
      } catch {
        Alert.alert('Error', 'Failed to load product.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isOnline]);

  const addVariant = () => setVariants((prev) => [...prev, makeVariantDraft()]);
  const removeVariant = (key: string) => setVariants((prev) => prev.filter((v) => v.key !== key));
  const updateVariant = (key: string, field: keyof Omit<VariantDraft, 'key'>, value: string) =>
    setVariants((prev) => prev.map((v) => (v.key === key ? { ...v, [field]: value } : v)));

  const handleUpdate = async () => {
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
    const variantData: Omit<ApiProductVariant, 'stock'>[] = validVariants.map((v) => ({
      sku: v.sku.trim().toUpperCase(),
      label: v.label.trim() || v.sku,
      size: v.size.trim() || undefined,
      color: v.color.trim() || undefined,
      priceAdjustment: 0,
    }));

    setSubmitting(true);
    try {
      await apiUpdateProduct(id!, { name: name.trim(), price: priceNum, imageUrl: imageUrl.trim() || null, variants: variantData });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to update product.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = () => {
    Alert.alert(
      'Deactivate Product',
      `"${product?.name}" will be hidden from the sales grid but preserved in history. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await apiDeactivateProduct(id!);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to deactivate product.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (!isOnline) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Product</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.offlineState}>
          <Text style={styles.offlineIcon}>📵</Text>
          <Text style={styles.offlineTitle}>Internet Required</Text>
          <Text style={styles.offlineSubtext}>Editing products requires an internet connection.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Product</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Product</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Product not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Product</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Product Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Info</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Product name *"
            accessibilityLabel="Product name"
          />
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="Base price *"
            keyboardType="decimal-pad"
            accessibilityLabel="Product price"
          />
          <TextInput
            style={styles.input}
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="Image URL (optional)"
            keyboardType="url"
            autoCapitalize="none"
            accessibilityLabel="Product image URL"
          />
        </View>

        {/* Variants */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Variants</Text>
            <Pressable onPress={addVariant} style={styles.addVariantButton}>
              <Text style={styles.addVariantText}>+ Add Variant</Text>
            </Pressable>
          </View>

          {variants.map((variant, idx) => (
            <View key={variant.key} style={styles.variantCard}>
              <View style={styles.variantCardHeader}>
                <Text style={styles.variantCardTitle}>Variant {idx + 1}</Text>
                {variants.length > 1 && (
                  <Pressable onPress={() => removeVariant(variant.key)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                )}
              </View>
              <TextInput
                style={styles.input}
                value={variant.sku}
                onChangeText={(v) => updateVariant(variant.key, 'sku', v)}
                placeholder="SKU *"
                autoCapitalize="characters"
                accessibilityLabel={`Variant ${idx + 1} SKU`}
              />
              <TextInput
                style={styles.input}
                value={variant.label}
                onChangeText={(v) => updateVariant(variant.key, 'label', v)}
                placeholder="Display label"
                accessibilityLabel={`Variant ${idx + 1} label`}
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  value={variant.size}
                  onChangeText={(v) => updateVariant(variant.key, 'size', v)}
                  placeholder="Size"
                  accessibilityLabel={`Variant ${idx + 1} size`}
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  value={variant.color}
                  onChangeText={(v) => updateVariant(variant.key, 'color', v)}
                  placeholder="Color"
                  accessibilityLabel={`Variant ${idx + 1} color`}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <Pressable
          style={[styles.updateButton, submitting && styles.buttonDisabled]}
          onPress={handleUpdate}
          disabled={submitting}
          accessibilityLabel="Save product changes"
        >
          <Text style={styles.updateButtonText}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.deactivateButton, submitting && styles.buttonDisabled]}
          onPress={handleDeactivate}
          disabled={submitting}
          accessibilityLabel="Deactivate product"
        >
          <Text style={styles.deactivateButtonText}>Deactivate Product</Text>
        </Pressable>

        <Text style={styles.deactivateNote}>
          Deactivating hides the product from the sales grid but preserves it in transaction history.
        </Text>
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
  updateButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  updateButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deactivateButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ef4444',
  },
  deactivateButtonText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
  deactivateNote: { fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 18 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, color: '#666' },
  offlineState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  offlineIcon: { fontSize: 48, marginBottom: 16 },
  offlineTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  offlineSubtext: { fontSize: 14, color: '#666', textAlign: 'center' },
});

import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { CachedProduct } from '@/db/products';
import { useCartStore } from '@/stores/cartStore';
import { useTheme } from '@/hooks/use-theme';
import { currencySymbol } from '@/utils/currencySymbol';
import { stockColor } from '@/utils/stockColor';
import { VariantPicker } from './VariantPicker';

interface Props {
  product: CachedProduct;
}

/**
 * ProductTile renders a touch-friendly card for a single product.
 * - Shows product name, price, and per-variant stock counts
 * - Single-variant: tap adds directly to cart
 * - Multi-variant: tap opens inline VariantPicker
 */
export function ProductTile({ product }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const c = useTheme();

  const handlePress = () => {
    if (product.variants.length === 1) {
      const variant = product.variants[0];
      const origPrice = (product as CachedProduct & { originalPrice?: number }).originalPrice ?? product.price;
      addItem({
        productId: product.id,
        variantSku: variant.sku,
        productName: product.name,
        variantLabel: variant.label,
        quantity: 1,
        priceAtSale: product.price + variant.priceAdjustment,
        originalPrice: origPrice + variant.priceAdjustment,
      });
    } else {
      setShowPicker((v) => !v);
    }
  };

  const stockSummary = product.variants
    .map((v) => `${v.label}:${v.stock}`)
    .join(' ');

  const minStock = Math.min(...product.variants.map((v) => v.stock));

  return (
    <View style={styles.wrapper}>
      <Pressable
        testID="product-tile"
        style={({ pressed }) => [styles.card, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }, pressed && { opacity: 0.85, backgroundColor: c.rowPressed }]}
        onPress={handlePress}
        accessibilityLabel={product.name}
      >
        {/* Placeholder image icon (no offline image storage per user decision) */}
        <View style={[styles.imagePlaceholder, { backgroundColor: c.backgroundElement }]}>
          <Text style={styles.imageIcon}>{'🏷️'}</Text>
        </View>

        <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
          {product.name}
        </Text>

        <Text style={[styles.price, { color: c.accent }]}>
          {`${currencySymbol(useCartStore.getState().currency)} ${product.price.toFixed(2)}`}
        </Text>

        <Text style={[styles.stock, { color: stockColor(minStock) }]} numberOfLines={1}>
          {stockSummary}
        </Text>
      </Pressable>

      {showPicker && (
        <VariantPicker
          product={product}
          onClose={() => setShowPicker(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    margin: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: 4,
  },
  pressed: {
    opacity: 0.85,
    backgroundColor: '#f8f8f8',
  },
  imagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  imageIcon: {
    fontSize: 20,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#208AEF',
  },
  stock: {
    fontSize: 11,
    color: '#888',
  },
});

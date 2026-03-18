import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { ProductVariant, CachedProduct } from '@/db/products';
import { useCartStore } from '@/stores/cartStore';
import { stockColor } from '@/utils/stockColor';

interface Props {
  product: CachedProduct;
  onClose: () => void;
}

/**
 * VariantPicker renders an inline list of variants when the product tile is tapped.
 * Each variant shows its label and stock count.
 * Zero-stock variants remain tappable (concert sales never rejected).
 */
export function VariantPicker({ product, onClose }: Props) {
  const addItem = useCartStore((state) => state.addItem);

  const handleVariantPress = (variant: ProductVariant) => {
    addItem({
      productId: product.id,
      variantSku: variant.sku,
      productName: product.name,
      variantLabel: variant.label,
      quantity: 1,
      priceAtSale: product.price + variant.priceAdjustment,
    });
    onClose();
  };

  return (
    <View testID="variant-picker" style={styles.container}>
      <Text style={styles.title}>{product.name}</Text>
      {product.variants.map((variant) => (
        <Pressable
          key={variant.sku}
          style={({ pressed }) => [styles.variantRow, pressed && styles.pressed]}
          onPress={() => handleVariantPress(variant)}
          accessibilityLabel={`${variant.label}, ${variant.stock} left`}
        >
          <Text style={styles.variantLabel}>{variant.label}</Text>
          <Text style={[styles.stockLabel, { color: stockColor(variant.stock) }]}>
            {variant.stock} left
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 44,
  },
  pressed: {
    backgroundColor: '#f5f5f5',
  },
  variantLabel: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  stockLabel: {
    fontSize: 14,
    color: '#666',
  },
});

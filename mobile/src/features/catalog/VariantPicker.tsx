import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { ProductVariant, CachedProduct } from '@/db/products';
import { useCartStore } from '@/stores/cartStore';
import { useTheme } from '@/hooks/use-theme';
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
  const c = useTheme();

  const handleVariantPress = (variant: ProductVariant) => {
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
    onClose();
  };

  return (
    <View testID="variant-picker" style={[styles.container, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
      <Text style={[styles.title, { color: c.text }]}>{product.name}</Text>
      <View style={{ height: 1, backgroundColor: c.cardBorder, marginBottom: 4 }} />
      {product.variants.map((variant, index) => (
        <React.Fragment key={variant.sku}>
          {index > 0 && <View style={{ height: 1, backgroundColor: c.cardBorder, marginHorizontal: 4 }} />}
          <Pressable
            style={({ pressed }) => [
              styles.variantRow,
              pressed && { backgroundColor: c.rowPressed },
            ]}
            onPress={() => handleVariantPress(variant)}
            accessibilityLabel={`${variant.label}, ${variant.stock} left`}
          >
            <Text style={[styles.variantLabel, { color: c.text }]}>{variant.label}</Text>
            <Text style={[styles.stockLabel, { color: stockColor(variant.stock) }]}>
              {variant.stock} left
            </Text>
          </Pressable>
        </React.Fragment>
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

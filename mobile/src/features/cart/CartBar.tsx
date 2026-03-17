import React, { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCartStore } from '@/stores/cartStore';
import { CartSheet, CartSheetHandle } from './CartSheet';

/**
 * CartBar renders a sticky bottom bar during selling mode.
 * Shows item count + total. Tap to expand CartSheet for quantity editing.
 * Only visible when the cart has items.
 */
export function CartBar() {
  const items = useCartStore((state) => state.items);
  const total = useCartStore((state) => state.total());
  const currency = useCartStore((state) => state.currency);
  const sheetRef = useRef<CartSheetHandle>(null);

  if (items.length === 0) return null;

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';

  return (
    <>
      <Pressable
        testID="cart-bar"
        style={styles.wrapper}
        onPress={() => sheetRef.current?.open()}
        accessibilityLabel={`Cart: ${itemCount} items, ${symbol}${total.toFixed(2)}`}
      >
        {({ pressed }) => (
          <View style={[styles.bar, pressed && styles.pressed]}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{itemCount}</Text>
            </View>
            <Text style={styles.label}>
              {itemCount === 1 ? '1 item' : `${itemCount} items`}
            </Text>
            <Text style={styles.total}>
              {`${symbol}${total.toFixed(2)}`}
            </Text>
            <Text style={styles.chevron}>{'▲'}</Text>
          </View>
        )}
      </Pressable>

      <CartSheet ref={sheetRef} />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bar: {
    backgroundColor: '#208AEF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  pressed: {
    backgroundColor: '#1a7dd4',
  },
  badge: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#208AEF',
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  total: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  chevron: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
});

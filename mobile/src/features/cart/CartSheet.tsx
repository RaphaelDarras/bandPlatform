import { router } from 'expo-router';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

import { useCartStore } from '@/stores/cartStore';
import { currencySymbol } from '@/utils/currencySymbol';
import { useTheme } from '@/hooks/use-theme';

export interface CartSheetHandle {
  open: () => void;
  close: () => void;
}

/**
 * CartSheet is an expandable bottom sheet showing all cart items.
 * Provides quantity controls (+/-), item removal, and a "Review Sale" button.
 */
export const CartSheet = forwardRef<CartSheetHandle>((_, ref) => {
  const sheetRef = useRef<BottomSheet>(null);
  const items = useCartStore((state) => state.items);
  const currency = useCartStore((state) => state.currency);
  const total = useCartStore((state) => state.total());
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const c = useTheme();

  useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.snapToIndex(0),
    close: () => sheetRef.current?.close(),
  }));

  const symbol = currencySymbol(currency);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['60%', '90%']}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }}
      handleIndicatorStyle={{ backgroundColor: c.textSecondary }}
    >
      <BottomSheetView style={[styles.container, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
        <Text style={[styles.title, { color: c.text }]}>Cart</Text>

        <ScrollView style={styles.itemList} showsVerticalScrollIndicator={false}>
          {items.map((item) => (
            <View key={`${item.productId}:${item.variantSku}`} style={[styles.itemRow, { borderBottomColor: c.border }]} testID="cart-item">
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: c.text }]} numberOfLines={1}>
                  {item.productName}
                </Text>
                <Text style={[styles.itemVariant, { color: c.textSecondary }]}>{item.variantLabel}</Text>
              </View>

              <View style={styles.qtyControls}>
                <Pressable
                  style={[styles.qtyBtn, { backgroundColor: c.backgroundElement }]}
                  onPress={() =>
                    item.quantity > 1
                      ? updateQuantity(item.productId, item.variantSku, item.quantity - 1)
                      : removeItem(item.productId, item.variantSku)
                  }
                  accessibilityLabel={`Decrease ${item.productName}`}
                >
                  <Text style={[styles.qtyBtnText, { color: c.text }]}>{'−'}</Text>
                </Pressable>

                <Text style={[styles.qtyText, { color: c.text }]}>{item.quantity}</Text>

                <Pressable
                  style={[styles.qtyBtn, { backgroundColor: c.backgroundElement }]}
                  onPress={() => updateQuantity(item.productId, item.variantSku, item.quantity + 1)}
                  accessibilityLabel={`Increase ${item.productName}`}
                >
                  <Text style={[styles.qtyBtnText, { color: c.text }]}>{'+'}</Text>
                </Pressable>
              </View>

              <Text style={[styles.lineTotal, { color: c.text }]}>
                {`${symbol}${(item.priceAtSale * item.quantity).toFixed(2)}`}
              </Text>

              <Pressable
                style={styles.removeBtn}
                onPress={() => removeItem(item.productId, item.variantSku)}
                accessibilityLabel={`Remove ${item.productName}`}
              >
                <Text style={styles.removeBtnText}>{'✕'}</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.subtotalRow}>
            <Text style={[styles.subtotalLabel, { color: c.textSecondary }]}>Total</Text>
            <Text style={[styles.subtotalValue, { color: c.text }]}>
              {`${symbol}${total.toFixed(2)}`}
            </Text>
          </View>

          <Pressable
            testID="review-sale-btn"
            style={styles.reviewBtnWrapper}
            onPress={() => {
              sheetRef.current?.close();
              router.push('/selling/review');
            }}
          >
            {({ pressed }) => (
              <View style={[styles.reviewBtn, { backgroundColor: c.accent }, pressed && styles.reviewBtnPressed]}>
                <Text style={styles.reviewBtnText}>Review Sale</Text>
              </View>
            )}
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
});

CartSheet.displayName = 'CartSheet';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  itemList: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  itemVariant: {
    fontSize: 12,
    color: '#888',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1a1a1a',
    lineHeight: 22,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    minWidth: 24,
    textAlign: 'center',
  },
  lineTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    minWidth: 56,
    textAlign: 'right',
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    paddingTop: 12,
    gap: 12,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtotalLabel: {
    fontSize: 16,
    color: '#666',
  },
  subtotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  reviewBtnWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  reviewBtn: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reviewBtnPressed: {
    opacity: 0.85,
  },
  reviewBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

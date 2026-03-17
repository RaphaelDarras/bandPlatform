import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCartStore } from '@/stores/cartStore';
import { useSaleRecording } from '@/features/cart/useSaleRecording';

type PaymentMethod = 'Cash' | 'Card' | 'E-transfer' | 'PayPal';
const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Card', 'E-transfer', 'PayPal'];

type Currency = 'EUR' | 'GBP' | 'USD' | 'CAD';
const CURRENCIES: Currency[] = ['EUR', 'GBP', 'USD', 'CAD'];

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
  CAD: 'CA$',
};

/**
 * Sale review screen.
 * Shows all cart items with totals, payment method, currency, and discount controls.
 * Confirming writes atomically to SQLite + outbox and resets cart.
 */
export default function ReviewScreen() {
  const items = useCartStore((state) => state.items);
  const currency = useCartStore((state) => state.currency) as Currency;
  const discount = useCartStore((state) => state.discount);
  const discountType = useCartStore((state) => state.discountType);
  const total = useCartStore((state) => state.total());
  const setCurrency = useCartStore((state) => state.setCurrency);
  const setDiscount = useCartStore((state) => state.setDiscount);

  const { recordSale } = useSaleRecording();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [discountInput, setDiscountInput] = useState(discount > 0 ? String(discount) : '');
  const [loading, setLoading] = useState(false);

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  const handleDiscountChange = (text: string) => {
    setDiscountInput(text);
    const num = parseFloat(text);
    if (!isNaN(num) && num >= 0) {
      setDiscount(num, discountType);
    } else if (text === '' || text === '0') {
      setDiscount(0, discountType);
    }
  };

  const handleDiscountTypeToggle = () => {
    const newType = discountType === 'flat' ? 'percent' : 'flat';
    const num = parseFloat(discountInput);
    setDiscount(!isNaN(num) ? num : 0, newType);
  };

  const handleConfirm = async () => {
    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Add items before confirming.');
      return;
    }

    setLoading(true);
    try {
      await recordSale(paymentMethod);
      Alert.alert('Sale recorded!', '', [
        {
          text: 'OK',
          onPress: () => router.replace('/selling'),
        },
      ]);
    } catch (err) {
      console.error('[ReviewScreen] Failed to record sale:', err);
      Alert.alert('Error', 'Failed to record sale. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Item list */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items</Text>
            {items.map((item) => (
              <View key={item.variantSku} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemVariant}>
                    {item.variantLabel} × {item.quantity}
                  </Text>
                </View>
                <Text style={styles.lineTotal}>
                  {`${symbol}${(item.priceAtSale * item.quantity).toFixed(2)}`}
                </Text>
              </View>
            ))}
          </View>

          {/* Payment method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.chipRow}>
              {PAYMENT_METHODS.map((method) => (
                <Pressable
                  key={method}
                  style={[
                    styles.chip,
                    paymentMethod === method && styles.chipSelected,
                  ]}
                  onPress={() => setPaymentMethod(method)}
                  accessibilityLabel={method}
                >
                  <Text
                    style={[
                      styles.chipText,
                      paymentMethod === method && styles.chipTextSelected,
                    ]}
                  >
                    {method}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Currency */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Currency</Text>
            <View style={styles.chipRow}>
              {CURRENCIES.map((cur) => (
                <Pressable
                  key={cur}
                  style={[styles.chip, currency === cur && styles.chipSelected]}
                  onPress={() => setCurrency(cur)}
                  accessibilityLabel={cur}
                >
                  <Text
                    style={[
                      styles.chipText,
                      currency === cur && styles.chipTextSelected,
                    ]}
                  >
                    {cur}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Discount */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Discount</Text>
            <View style={styles.discountRow}>
              <TextInput
                style={styles.discountInput}
                value={discountInput}
                onChangeText={handleDiscountChange}
                placeholder="0"
                keyboardType="decimal-pad"
                accessibilityLabel="Discount amount"
              />
              <Pressable
                style={styles.discountToggle}
                onPress={handleDiscountTypeToggle}
                accessibilityLabel={`Toggle discount type, currently ${discountType}`}
              >
                <Text style={styles.discountToggleText}>
                  {discountType === 'flat' ? `${symbol} flat` : '% percent'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Grand total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {`${symbol}${total.toFixed(2)}`}
            </Text>
          </View>
        </ScrollView>

        {/* Confirm button */}
        <View style={styles.footer}>
          <Pressable
            testID="confirm-sale-btn"
            style={styles.confirmBtnWrapper}
            onPress={handleConfirm}
            disabled={loading}
            accessibilityLabel="Confirm Sale"
          >
            {({ pressed }) => (
              <View style={[
                styles.confirmBtn,
                pressed && styles.confirmBtnPressed,
                loading && styles.confirmBtnDisabled,
              ]}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm Sale</Text>
                )}
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 16,
    gap: 20,
    paddingBottom: 8,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  itemVariant: {
    fontSize: 13,
    color: '#888',
  },
  lineTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    minWidth: 64,
    textAlign: 'right',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 36,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: '#EBF4FF',
    borderColor: '#208AEF',
  },
  chipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#208AEF',
    fontWeight: '700',
  },
  discountRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  discountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
    minHeight: 44,
  },
  discountToggle: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 44,
    justifyContent: 'center',
  },
  discountToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  totalLabel: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  footer: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#f8f9fa',
  },
  confirmBtnWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmBtn: {
    backgroundColor: '#208AEF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#208AEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 54,
    justifyContent: 'center',
  },
  confirmBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});

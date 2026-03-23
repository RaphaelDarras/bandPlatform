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

import { useTheme } from '@/hooks/use-theme';
import { useCartStore } from '@/stores/cartStore';
import { currencySymbol } from '@/utils/currencySymbol';
import { useSaleRecording } from '@/features/cart/useSaleRecording';

type PaymentMethod = 'Cash' | 'Card' | 'PayPal';
const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Card', 'PayPal'];

type Currency = 'EUR' | 'GBP' | 'CHF' | 'SEK' | 'NOK' | 'DKK' | 'PLN' | 'CZK' | 'HUF' | 'RON';
const CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { code: 'SEK', label: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', label: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', label: 'Danish Krone', symbol: 'kr' },
  { code: 'PLN', label: 'Polish Zloty', symbol: 'zł' },
  { code: 'CZK', label: 'Czech Koruna', symbol: 'Kč' },
  { code: 'HUF', label: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'RON', label: 'Romanian Leu', symbol: 'lei' },
];


/**
 * Sale review screen.
 * Shows all cart items with totals, payment method, currency, and discount controls.
 * Confirming writes atomically to SQLite + outbox and resets cart.
 */
export default function ReviewScreen() {
  const c = useTheme();
  const items = useCartStore((state) => state.items);
  const currency = useCartStore((state) => state.currency) as Currency;
  const discount = useCartStore((state) => state.discount);
  const discountType = useCartStore((state) => state.discountType);
  const total = useCartStore((state) => state.total());
  const setCurrency = useCartStore((state) => state.setCurrency);
  const setDiscount = useCartStore((state) => state.setDiscount);

  const setConcertId = useCartStore((state) => state.setConcertId);
  const { recordSale } = useSaleRecording();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Card');
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<{ method: PaymentMethod; amount: string }[]>([]);
  const [discountInput, setDiscountInput] = useState(discount > 0 ? String(discount) : '');
  const [loading, setLoading] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const symbol = currencySymbol(currency);

  const handleToggleSplit = () => {
    if (!splitMode) {
      // Enter split mode — initialize with current method and full total
      setSplits([{ method: paymentMethod, amount: total.toFixed(2) }]);
      setSplitMode(true);
    } else {
      // Exit split mode — revert to single method
      if (splits.length > 0) setPaymentMethod(splits[0].method);
      setSplits([]);
      setSplitMode(false);
    }
  };

  const handleAddSplit = () => {
    const usedMethods = new Set(splits.map((s) => s.method));
    const next = PAYMENT_METHODS.find((m) => !usedMethods.has(m));
    if (!next) return; // all methods already used
    setSplits([...splits, { method: next, amount: '' }]);
  };

  const handleRemoveSplit = (index: number) => {
    if (splits.length <= 1) return;
    setSplits(splits.filter((_, i) => i !== index));
  };

  const handleSplitMethodChange = (index: number, method: PaymentMethod) => {
    setSplits(splits.map((s, i) => (i === index ? { ...s, method } : s)));
  };

  const handleSplitAmountChange = (index: number, amount: string) => {
    setSplits(splits.map((s, i) => (i === index ? { ...s, amount } : s)));
  };

  const splitTotal = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const splitBalanced = Math.abs(splitTotal - total) < 0.01;

  const hasOverrides = items.some((i) => i.priceAtSale !== i.originalPrice) || currency !== 'EUR';

  const handleResetDefaults = () => {
    // Reset prices to original (non-overridden) values
    const resetItems = items.map((i) => ({ ...i, priceAtSale: i.originalPrice }));
    useCartStore.setState({ items: resetItems, currency: 'EUR' });
    setCurrencyOpen(false);
  };

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
    if (splitMode && !splitBalanced) {
      Alert.alert('Split not balanced', `Split amounts must equal ${symbol}${total.toFixed(2)}.`);
      return;
    }

    setLoading(true);
    try {
      // Encode split as "Card:30.00/Cash:20.00" or single method name
      const paymentLabel = splitMode
        ? splits.map((s) => `${s.method}:${parseFloat(s.amount).toFixed(2)}`).join('/')
        : paymentMethod;
      await recordSale(paymentLabel);
      Alert.alert('Sale recorded!', '', [
        {
          text: 'OK',
          onPress: () => router.back(),
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
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['bottom']}>
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
          <View style={[styles.section, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Items</Text>
            {items.map((item) => (
              <View key={`${item.productId}:${item.variantSku}`} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: c.text }]}>{item.productName}</Text>
                  <Text style={[styles.itemVariant, { color: c.textSecondary }]}>
                    {item.variantLabel} × {item.quantity}
                  </Text>
                </View>
                <Text style={[styles.lineTotal, { color: c.text }]}>
                  {`${symbol}${(item.priceAtSale * item.quantity).toFixed(2)}`}
                </Text>
              </View>
            ))}
          </View>

          {/* Payment method */}
          <View style={[styles.section, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Payment Method</Text>
              <Pressable onPress={handleToggleSplit} accessibilityLabel="Toggle split payment">
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.accent }}>
                  {splitMode ? 'Single' : 'Split'}
                </Text>
              </Pressable>
            </View>

            {!splitMode ? (
              <View style={styles.chipRow}>
                {PAYMENT_METHODS.map((method) => (
                  <Pressable
                    key={method}
                    style={[
                      styles.chip,
                      { backgroundColor: c.backgroundElement },
                      paymentMethod === method && styles.chipSelected,
                    ]}
                    onPress={() => setPaymentMethod(method)}
                    accessibilityLabel={method}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: c.textSecondary },
                        paymentMethod === method && styles.chipTextSelected,
                      ]}
                    >
                      {method}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {splits.map((split, index) => (
                  <View key={index} style={styles.splitRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.chipRow}>
                        {PAYMENT_METHODS.map((method) => (
                          <Pressable
                            key={method}
                            style={[
                              styles.chipSmall,
                              { backgroundColor: c.backgroundElement },
                              split.method === method && styles.chipSelected,
                            ]}
                            onPress={() => handleSplitMethodChange(index, method)}
                          >
                            <Text
                              style={[
                                styles.chipTextSmall,
                                { color: c.textSecondary },
                                split.method === method && styles.chipTextSelected,
                              ]}
                            >
                              {method}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <TextInput
                      style={[styles.splitAmountInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
                      value={split.amount}
                      onChangeText={(text) => handleSplitAmountChange(index, text)}
                      placeholder="0.00"
                      placeholderTextColor={c.textSecondary}
                      keyboardType="decimal-pad"
                      accessibilityLabel={`Amount for ${split.method}`}
                    />
                    {splits.length > 1 && (
                      <Pressable onPress={() => handleRemoveSplit(index)} style={{ padding: 4 }}>
                        <Text style={{ color: c.danger, fontSize: 18, fontWeight: '700' }}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
                {splits.length < PAYMENT_METHODS.length && (
                  <Pressable onPress={handleAddSplit} style={styles.addSplitBtn}>
                    <Text style={{ color: c.accent, fontWeight: '600', fontSize: 14 }}>+ Add payment method</Text>
                  </Pressable>
                )}
                <View style={[styles.splitSummary, { borderTopColor: c.border }]}>
                  <Text style={[styles.splitSummaryLabel, { color: c.textSecondary }]}>
                    Split total
                  </Text>
                  <Text style={[styles.splitSummaryValue, { color: splitBalanced ? c.success : c.danger }]}>
                    {`${symbol}${splitTotal.toFixed(2)} / ${symbol}${total.toFixed(2)}`}
                  </Text>
                </View>
                {!splitBalanced && (
                  <Text style={{ fontSize: 12, color: c.danger, textAlign: 'center' }}>
                    {splitTotal < total
                      ? `${symbol}${(total - splitTotal).toFixed(2)} remaining`
                      : `${symbol}${(splitTotal - total).toFixed(2)} over`}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Currency */}
          <View style={[styles.section, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Currency</Text>
            <Pressable
              style={[styles.dropdownBtn, { backgroundColor: c.backgroundElement, borderColor: c.inputBorder }]}
              onPress={() => setCurrencyOpen((v) => !v)}
              accessibilityLabel="Select currency"
            >
              <Text style={[styles.dropdownBtnText, { color: c.text }]}>
                {`${currencySymbol(currency)}  ${currency}`}
              </Text>
              <Text style={[styles.dropdownChevron, { color: c.textSecondary }]}>{currencyOpen ? '▲' : '▼'}</Text>
            </Pressable>
            {currencyOpen && (
              <View style={[styles.dropdownList, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
                {CURRENCIES.map((cur) => (
                  <Pressable
                    key={cur.code}
                    style={({ pressed }) => [
                      styles.dropdownOption,
                      { borderBottomColor: c.border },
                      currency === cur.code && { backgroundColor: c.backgroundSelected },
                      pressed && { backgroundColor: c.rowPressed },
                    ]}
                    onPress={() => { setCurrency(cur.code); setCurrencyOpen(false); }}
                    accessibilityLabel={`${cur.label} (${cur.code})`}
                  >
                    <Text style={[styles.dropdownOptionSymbol, { color: c.textSecondary }]}>{cur.symbol}</Text>
                    <Text style={[styles.dropdownOptionText, { color: c.text }]}>{cur.code}</Text>
                    <Text style={[styles.dropdownOptionLabel, { color: c.textSecondary }]}>{cur.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Reset to defaults */}
          {hasOverrides && (
            <Pressable
              onPress={handleResetDefaults}
              style={({ pressed }) => [
                styles.resetBtn,
                { backgroundColor: c.backgroundElement, borderWidth: 1, borderColor: c.border },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel="Reset to default currency and prices"
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.accent, textAlign: 'center' }}>
                Reset to default prices & EUR
              </Text>
            </Pressable>
          )}

          {/* Discount */}
          <View style={[styles.section, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Discount</Text>
            <View style={styles.discountRow}>
              <TextInput
                style={[styles.discountInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
                value={discountInput}
                onChangeText={handleDiscountChange}
                placeholder="0"
                placeholderTextColor={c.textSecondary}
                keyboardType="decimal-pad"
                accessibilityLabel="Discount amount"
              />
              <Pressable
                style={[styles.discountToggle, { backgroundColor: c.backgroundElement, borderColor: c.inputBorder }]}
                onPress={handleDiscountTypeToggle}
                accessibilityLabel={`Toggle discount type, currently ${discountType}`}
              >
                <Text style={[styles.discountToggleText, { color: c.text }]}>
                  {discountType === 'flat' ? `${symbol} flat` : '% percent'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Grand total */}
          <View style={[styles.totalRow, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
            <Text style={[styles.totalLabel, { color: c.textSecondary }]}>Total</Text>
            <Text style={[styles.totalValue, { color: c.text }]}>
              {`${symbol}${total.toFixed(2)}`}
            </Text>
          </View>
        </ScrollView>

        {/* Confirm button */}
        <View style={[styles.footer, { backgroundColor: c.background }]}>
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
  resetBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipTextSmall: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  splitAmountInput: {
    width: 80,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
    minHeight: 40,
  },
  addSplitBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  splitSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  splitSummaryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  splitSummaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  dropdownBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dropdownChevron: {
    fontSize: 12,
  },
  dropdownList: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  dropdownOptionSymbol: {
    fontSize: 14,
    fontWeight: '600',
    width: 32,
  },
  dropdownOptionText: {
    fontSize: 15,
    fontWeight: '600',
    width: 36,
  },
  dropdownOptionLabel: {
    fontSize: 13,
    flex: 1,
  },
});

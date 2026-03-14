import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDb } from '@/db';
import { getLocalSales } from '@/db/sales';
import type { LocalSaleRow } from '@/db/sales';
import { useHistory } from '@/features/history/useHistory';
import { getCachedConcerts } from '@/db/concerts';

interface ParsedItem {
  productId: string;
  variantSku: string;
  quantity: number;
  priceAtSale: number;
}

interface SaleDetail extends LocalSaleRow {
  parsedItems: ParsedItem[];
  total_amount?: number; // actual SQLite column (snake_case)
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SaleDetailScreen() {
  const { saleId } = useLocalSearchParams<{ saleId: string }>();
  const { voidSale, unvoidSale } = useHistory();

  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [concertName, setConcertName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadSale = useCallback(async () => {
    if (!saleId) return;
    setLoading(true);
    try {
      const db = await getDb();
      const rows = await getLocalSales(db);
      const row = rows.find((r) => r.id === saleId);
      if (row) {
        const detail: SaleDetail = {
          ...row,
          parsedItems: JSON.parse(row.items_json ?? '[]') as ParsedItem[],
        };
        setSale(detail);

        // Load concert name
        const concerts = await getCachedConcerts(db);
        const concert = concerts.find((c) => c.id === row.concertId);
        setConcertName(concert?.name ?? row.concertId);
      }
    } catch (err) {
      console.error('[SaleDetailScreen] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    loadSale();
  }, [loadSale]);

  const handleVoid = () => {
    if (!sale) return;
    Alert.alert(
      'Void Sale',
      'Are you sure you want to void this sale? Stock will be restored.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void Sale',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await voidSale(sale.id);
              setSale((prev) => prev ? { ...prev, voided: 1 } : prev);
            } catch (err) {
              console.error('[SaleDetailScreen] Void error:', err);
              Alert.alert('Error', 'Failed to void sale.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUnvoid = () => {
    if (!sale) return;
    Alert.alert(
      'Unvoid Sale',
      'Restore this sale? Stock will be re-deducted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unvoid',
          onPress: async () => {
            setActionLoading(true);
            try {
              await unvoidSale(sale.id);
              setSale((prev) => prev ? { ...prev, voided: 0 } : prev);
            } catch (err) {
              console.error('[SaleDetailScreen] Unvoid error:', err);
              Alert.alert('Error', 'Failed to unvoid sale.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!sale) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Sale not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isVoided = sale.voided === 1;
  const totalAmount = (sale as unknown as Record<string, number>)['total_amount'] ?? sale.totalAmount ?? 0;

  // Calculate subtotal from items
  const subtotal = sale.parsedItems.reduce(
    (sum, item) => sum + item.priceAtSale * item.quantity,
    0
  );

  const discountAmount =
    sale.discountType === 'flat'
      ? sale.discount
      : subtotal * (sale.discount / 100);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Sale Detail</Text>
        {isVoided ? (
          <View style={styles.voidedHeaderBadge}>
            <Text style={styles.voidedHeaderBadgeText}>VOIDED</Text>
          </View>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Metadata */}
        <View style={styles.card}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Concert</Text>
            <Text style={styles.metaValue}>{concertName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date & Time</Text>
            <Text style={styles.metaValue}>{formatTimestamp(sale.created_at)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Payment</Text>
            <Text style={styles.metaValue}>{sale.paymentMethod}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Currency</Text>
            <Text style={styles.metaValue}>{sale.currency}</Text>
          </View>
          {isVoided && sale.voided_at && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Voided At</Text>
              <Text style={[styles.metaValue, styles.voidedText]}>
                {formatTimestamp(sale.voided_at)}
              </Text>
            </View>
          )}
        </View>

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {sale.parsedItems.map((item, index) => (
            <View key={`${item.productId}-${item.variantSku}-${index}`} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemSku}>{item.variantSku}</Text>
                <Text style={styles.itemQty}>{`× ${item.quantity}`}</Text>
              </View>
              <View style={styles.itemPriceCol}>
                <Text style={styles.itemUnitPrice}>{`${sale.currency} ${item.priceAtSale.toFixed(2)}`}</Text>
                <Text style={styles.itemLineTotal}>
                  {`${sale.currency} ${(item.priceAtSale * item.quantity).toFixed(2)}`}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{`${sale.currency} ${subtotal.toFixed(2)}`}</Text>
          </View>
          {sale.discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {`Discount (${sale.discountType === 'flat' ? `${sale.currency} flat` : `${sale.discount}%`})`}
              </Text>
              <Text style={[styles.summaryValue, styles.discountValue]}>
                {`-${sale.currency} ${discountAmount.toFixed(2)}`}
              </Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {`${sale.currency} ${totalAmount.toFixed(2)}`}
            </Text>
          </View>
        </View>

        {/* Void / Unvoid action */}
        <View style={styles.actionsCard}>
          {!isVoided ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.voidBtn,
                pressed && styles.actionBtnPressed,
                actionLoading && styles.actionBtnDisabled,
              ]}
              onPress={handleVoid}
              disabled={actionLoading}
              accessibilityLabel="Void Sale"
            >
              {actionLoading ? (
                <ActivityIndicator color="#dc2626" />
              ) : (
                <Text style={styles.voidBtnText}>Void Sale</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.unvoidBtn,
                pressed && styles.actionBtnPressed,
                actionLoading && styles.actionBtnDisabled,
              ]}
              onPress={handleUnvoid}
              disabled={actionLoading}
              accessibilityLabel="Unvoid Sale"
            >
              {actionLoading ? (
                <ActivityIndicator color="#208AEF" />
              ) : (
                <Text style={styles.unvoidBtnText}>Unvoid Sale</Text>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#888' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backText: { fontSize: 16, color: '#208AEF', fontWeight: '500', minWidth: 48 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  voidedHeaderBadge: {
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  voidedHeaderBadgeText: { fontSize: 11, fontWeight: '700', color: '#dc2626' },
  scrollContent: { padding: 12, gap: 12, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
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
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metaLabel: { fontSize: 14, color: '#888', fontWeight: '500', flex: 1 },
  metaValue: { fontSize: 14, color: '#1a1a1a', fontWeight: '600', flex: 2, textAlign: 'right' },
  voidedText: { color: '#dc2626' },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  itemInfo: { flex: 1, gap: 2 },
  itemSku: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  itemQty: { fontSize: 12, color: '#888' },
  itemPriceCol: { alignItems: 'flex-end', gap: 2 },
  itemUnitPrice: { fontSize: 12, color: '#888' },
  itemLineTotal: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  discountValue: { color: '#16a34a' },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#444' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  actionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  voidBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  unvoidBtn: {
    backgroundColor: '#EBF4FF',
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  actionBtnPressed: { opacity: 0.85 },
  actionBtnDisabled: { opacity: 0.5 },
  voidBtnText: { color: '#dc2626', fontSize: 16, fontWeight: '700' },
  unvoidBtnText: { color: '#208AEF', fontSize: 16, fontWeight: '700' },
});

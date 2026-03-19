import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDb } from '@/db';
import { getLocalSales, updateSaleConcert } from '@/db/sales';
import type { LocalSaleRow } from '@/db/sales';
import { useHistory } from '@/features/history/useHistory';
import * as Crypto from 'expo-crypto';
import { requestSync } from '@/features/sync/SyncManager';
import { apiClient } from '@/api/client';
import { getCachedConcerts, type CachedConcert } from '@/db/concerts';

function concertLabel(c: CachedConcert): string {
  const location = [c.venue || c.city, c.country].filter(Boolean).join(', ');
  const date = new Date(c.date).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return location ? `${location} — ${date}` : date;
}

interface ParsedItem {
  productId: string;
  variantSku: string;
  quantity: number;
  priceAtSale: number;
}

interface SaleDetail extends LocalSaleRow {
  parsedItems: ParsedItem[];
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
  const [concertId, setConcertId] = useState<string>('');
  const [concerts, setConcerts] = useState<CachedConcert[]>([]);
  const [showConcertPicker, setShowConcertPicker] = useState(false);
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

        const allConcerts = await getCachedConcerts(db);
        setConcerts(allConcerts);

        const rawConcertId = row.concertId ?? '';
        setConcertId(rawConcertId);
        const concert = allConcerts.find((c) => c.id === rawConcertId);
        setConcertName(concert ? concertLabel(concert) : (rawConcertId || 'No concert'));
      }
    } catch (err) {
      console.error('[SaleDetailScreen] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  const handleAssignConcert = useCallback(async (selectedId: string) => {
    if (!saleId) return;
    setShowConcertPicker(false);
    try {
      const db = await getDb();
      const now = Date.now();
      // 1. Update local SQLite
      await updateSaleConcert(db, saleId, selectedId);
      // 2. Queue outbox entry — idempotency key ensures only the latest assignment wins
      await db.runAsync(
        `INSERT OR REPLACE INTO outbox
         (id, type, payload, idempotency_key, status, attempt_count, next_attempt_at, created_at)
         VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)`,
        [
          Crypto.randomUUID(),
          'sale_update_concert',
          JSON.stringify({ saleId, concertId: selectedId }),
          `sale_update_concert:${saleId}`,   // one active entry per sale — INSERT OR REPLACE overwrites previous
          now,
        ]
      );
      setConcertId(selectedId);
      const concert = concerts.find((c) => c.id === selectedId);
      setConcertName(concert ? concertLabel(concert) : (selectedId || 'No concert'));
      // Kick off sync immediately (fire-and-forget)
      requestSync(db, apiClient);
    } catch (err) {
      console.error('[SaleDetailScreen] Assign concert error:', err);
      Alert.alert('Error', 'Failed to assign concert.');
    }
  }, [saleId, concerts]);

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
              await voidSale(sale.id, sale.parsedItems);
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
              await unvoidSale(sale.id, sale.parsedItems);
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
  const totalAmount = sale.totalAmount ?? 0;

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
            <View style={styles.metaValueRow}>
              <Text style={styles.metaValue}>{concertName}</Text>
              <Pressable
                onPress={() => setShowConcertPicker(true)}
                accessibilityLabel="Change concert"
                style={styles.changeBtn}
              >
                <Text style={styles.changeBtnText}>Change</Text>
              </Pressable>
            </View>
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
              style={styles.actionBtnWrapper}
              onPress={handleVoid}
              disabled={actionLoading}
              accessibilityLabel="Void Sale"
            >
              {({ pressed }) => (
                <View style={[
                  styles.actionBtn,
                  styles.voidBtn,
                  pressed && styles.actionBtnPressed,
                  actionLoading && styles.actionBtnDisabled,
                ]}>
                  {actionLoading ? (
                    <ActivityIndicator color="#dc2626" />
                  ) : (
                    <Text style={styles.voidBtnText}>Void Sale</Text>
                  )}
                </View>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={styles.actionBtnWrapper}
              onPress={handleUnvoid}
              disabled={actionLoading}
              accessibilityLabel="Unvoid Sale"
            >
              {({ pressed }) => (
                <View style={[
                  styles.actionBtn,
                  styles.unvoidBtn,
                  pressed && styles.actionBtnPressed,
                  actionLoading && styles.actionBtnDisabled,
                ]}>
                  {actionLoading ? (
                    <ActivityIndicator color="#208AEF" />
                  ) : (
                    <Text style={styles.unvoidBtnText}>Unvoid Sale</Text>
                  )}
                </View>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Concert picker modal */}
      <Modal
        visible={showConcertPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConcertPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowConcertPicker(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Assign Concert</Text>

            <Pressable
              style={[styles.pickerOption, !concertId && styles.pickerOptionSelected]}
              onPress={() => handleAssignConcert('')}
            >
              <Text style={[styles.pickerOptionText, !concertId && styles.pickerOptionTextSelected]}>
                No concert
              </Text>
            </Pressable>

            {concerts.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.pickerOption, concertId === c.id && styles.pickerOptionSelected]}
                onPress={() => handleAssignConcert(c.id)}
              >
                <Text style={[styles.pickerOptionText, concertId === c.id && styles.pickerOptionTextSelected]}>
                  {concertLabel(c)}
                </Text>
              </Pressable>
            ))}

            <Pressable style={styles.pickerCancel} onPress={() => setShowConcertPicker(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  metaValueRow: { flex: 2, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  changeBtn: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: '#EBF4FF' },
  changeBtnText: { fontSize: 12, color: '#208AEF', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 4 },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  pickerOption: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 10 },
  pickerOptionSelected: { backgroundColor: '#EBF4FF' },
  pickerOptionText: { fontSize: 15, color: '#333' },
  pickerOptionTextSelected: { color: '#208AEF', fontWeight: '700' },
  pickerCancel: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  pickerCancelText: { fontSize: 15, color: '#ef4444', fontWeight: '600' },
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
  actionBtnWrapper: { borderRadius: 12, overflow: 'hidden' },
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

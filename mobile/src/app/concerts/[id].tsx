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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDb } from '@/db';
import type { CachedConcert } from '@/db/concerts';
import { getConcertById, getConcertPriceOverrides, upsertPriceOverride, deletePriceOverride } from '@/db/concerts';
import type { ConcertPriceOverride } from '@/db/concerts';
import { getCachedProducts } from '@/db/products';
import type { CachedProduct } from '@/db/products';
import { useConcerts } from '@/features/concerts/useConcerts';
import type { ConcertTotals } from '@/features/concerts/useConcerts';
import { useCartStore } from '@/stores/cartStore';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function TotalsModal({
  visible,
  totals,
  concertName,
  onClose,
}: {
  visible: boolean;
  totals: ConcertTotals | null;
  concertName: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{concertName}</Text>
          <Text style={styles.modalSubtitle}>Concert Closed</Text>

          {totals && (
            <View style={styles.totalsGrid}>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>
                  {`€${totals.totalRevenue.toFixed(2)}`}
                </Text>
                <Text style={styles.totalLabel}>Total Revenue</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{totals.transactionCount}</Text>
                <Text style={styles.totalLabel}>Transactions</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{totals.itemsSold}</Text>
                <Text style={styles.totalLabel}>Items Sold</Text>
              </View>
            </View>
          )}

          <Pressable style={styles.modalBtn} onPress={onClose} accessibilityLabel="Close summary">
            <Text style={styles.modalBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function PriceOverrideRow({
  override,
  products,
  onDelete,
}: {
  override: ConcertPriceOverride;
  products: CachedProduct[];
  onDelete: () => void;
}) {
  const product = products.find((p) => p.id === override.product_id);
  return (
    <View style={styles.overrideRow}>
      <View style={styles.overrideInfo}>
        <Text style={styles.overrideName}>{product?.name ?? override.product_id}</Text>
        <Text style={styles.overridePrice}>{`€${override.price.toFixed(2)}`}</Text>
      </View>
      <Pressable
        onPress={onDelete}
        accessibilityLabel={`Remove price override for ${product?.name ?? override.product_id}`}
        style={styles.deleteBtn}
      >
        <Text style={styles.deleteBtnText}>Remove</Text>
      </Pressable>
    </View>
  );
}

export default function ConcertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { closeConcert, reopenConcert, getConcertTotals } = useConcerts();
  const setConcertId = useCartStore((state) => state.setConcertId);

  const [concert, setConcert] = useState<CachedConcert | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [totals, setTotals] = useState<ConcertTotals | null>(null);
  const [showTotals, setShowTotals] = useState(false);
  const [overrides, setOverrides] = useState<ConcertPriceOverride[]>([]);
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [showEditPrices, setShowEditPrices] = useState(false);
  const [editProductId, setEditProductId] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const loadConcert = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const db = await getDb();
      const c = await getConcertById(db, id);
      setConcert(c);
      if (c) {
        const [ov, prods] = await Promise.all([
          getConcertPriceOverrides(db, id),
          getCachedProducts(db),
        ]);
        setOverrides(ov);
        setProducts(prods);
        // Load totals for display (especially for closed concerts)
        const t = await getConcertTotals(id);
        setTotals(t);
      }
    } catch (err) {
      console.error('[ConcertDetailScreen] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, getConcertTotals]);

  useEffect(() => {
    loadConcert();
  }, [loadConcert]);

  const handleStartSelling = () => {
    if (!concert) return;
    setConcertId(concert.id);
    router.push('/selling' as never);
  };

  const handleClose = async () => {
    if (!concert) return;
    Alert.alert(
      'Close Concert',
      `Are you sure you want to close "${concert.name}"? No more sales will be recorded for this concert.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Concert',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const t = await closeConcert(concert.id);
              setTotals(t);
              setConcert((prev) => prev ? { ...prev, active: 0 } : prev);
              setShowTotals(true);
            } catch (err) {
              console.error('[ConcertDetailScreen] Close error:', err);
              Alert.alert('Error', 'Failed to close concert. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReopen = async () => {
    if (!concert) return;
    Alert.alert(
      'Reopen Concert',
      `Reopen "${concert.name}" for selling?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reopen',
          onPress: async () => {
            setActionLoading(true);
            try {
              await reopenConcert(concert.id);
              setConcert((prev) => prev ? { ...prev, active: 1 } : prev);
            } catch (err) {
              console.error('[ConcertDetailScreen] Reopen error:', err);
              Alert.alert('Error', 'Failed to reopen concert.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAddOverride = async () => {
    if (!concert || !editProductId || !editPrice) return;
    const price = parseFloat(editPrice);
    if (isNaN(price) || price < 0) {
      Alert.alert('Invalid price', 'Enter a valid price.');
      return;
    }
    const db = await getDb();
    await upsertPriceOverride(db, concert.id, editProductId, price);
    setEditProductId('');
    setEditPrice('');
    const updated = await getConcertPriceOverrides(db, concert.id);
    setOverrides(updated);
  };

  const handleDeleteOverride = async (productId: string) => {
    if (!concert) return;
    const db = await getDb();
    await deletePriceOverride(db, concert.id, productId);
    const updated = await getConcertPriceOverrides(db, concert.id);
    setOverrides(updated);
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

  if (!concert) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Concert not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isActive = concert.active === 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {concert.name}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Concert info card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[styles.statusBadge, isActive ? styles.badgeActive : styles.badgeClosed]}>
              <Text style={[styles.statusBadgeText, isActive ? styles.badgeTextActive : styles.badgeTextClosed]}>
                {isActive ? 'Active' : 'Closed'}
              </Text>
            </View>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{formatDate(concert.date)}</Text>
          </View>
          {concert.venue && (
            <View style={styles.cardRow}>
              <Text style={styles.infoLabel}>Venue</Text>
              <Text style={styles.infoValue}>{concert.venue}</Text>
            </View>
          )}
          {concert.city && (
            <View style={styles.cardRow}>
              <Text style={styles.infoLabel}>City</Text>
              <Text style={styles.infoValue}>{concert.city}</Text>
            </View>
          )}
        </View>

        {/* Totals summary (always visible for closed, also shows after close) */}
        {totals && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sales Summary</Text>
            <View style={styles.totalsRow}>
              <View style={styles.totalCell}>
                <Text style={styles.totalCellValue}>
                  {`€${totals.totalRevenue.toFixed(2)}`}
                </Text>
                <Text style={styles.totalCellLabel}>Revenue</Text>
              </View>
              <View style={styles.totalCell}>
                <Text style={styles.totalCellValue}>{totals.transactionCount}</Text>
                <Text style={styles.totalCellLabel}>Transactions</Text>
              </View>
              <View style={styles.totalCell}>
                <Text style={styles.totalCellValue}>{totals.itemsSold}</Text>
                <Text style={styles.totalCellLabel}>Items Sold</Text>
              </View>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsCard}>
          {isActive ? (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  pressed && styles.actionBtnPressed,
                  actionLoading && styles.actionBtnDisabled,
                ]}
                onPress={handleStartSelling}
                disabled={actionLoading}
                accessibilityLabel="Start Selling"
              >
                <Text style={styles.actionBtnTextPrimary}>Start Selling</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnDanger,
                  pressed && styles.actionBtnPressed,
                  actionLoading && styles.actionBtnDisabled,
                ]}
                onPress={handleClose}
                disabled={actionLoading}
                accessibilityLabel="Close Concert"
              >
                {actionLoading ? (
                  <ActivityIndicator color="#dc2626" />
                ) : (
                  <Text style={styles.actionBtnTextDanger}>Close Concert</Text>
                )}
              </Pressable>
            </>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnSecondary,
                pressed && styles.actionBtnPressed,
                actionLoading && styles.actionBtnDisabled,
              ]}
              onPress={handleReopen}
              disabled={actionLoading}
              accessibilityLabel="Reopen Concert"
            >
              {actionLoading ? (
                <ActivityIndicator color="#208AEF" />
              ) : (
                <Text style={styles.actionBtnTextSecondary}>Reopen Concert</Text>
              )}
            </Pressable>
          )}
        </View>

        {/* Per-concert price overrides */}
        <View style={styles.card}>
          <View style={styles.overrideHeader}>
            <Text style={styles.sectionTitle}>Price Overrides</Text>
            <Pressable
              onPress={() => setShowEditPrices((v) => !v)}
              accessibilityLabel="Edit Prices"
            >
              <Text style={styles.editPricesBtn}>
                {showEditPrices ? 'Done' : 'Edit Prices'}
              </Text>
            </Pressable>
          </View>

          {overrides.length === 0 && !showEditPrices && (
            <Text style={styles.overrideEmpty}>No price overrides set for this concert.</Text>
          )}

          {overrides.map((ov) => (
            <PriceOverrideRow
              key={ov.product_id}
              override={ov}
              products={products}
              onDelete={() => handleDeleteOverride(ov.product_id)}
            />
          ))}

          {showEditPrices && (
            <View style={styles.addOverrideForm}>
              <Text style={styles.addOverrideLabel}>Add / Update Override</Text>
              {products.length > 0 ? (
                <View style={styles.overrideFormRow}>
                  <View style={{ flex: 2 }}>
                    {products.map((p) => (
                      <Pressable
                        key={p.id}
                        style={[
                          styles.productChip,
                          editProductId === p.id && styles.productChipSelected,
                        ]}
                        onPress={() => setEditProductId(p.id)}
                        accessibilityLabel={`Select product ${p.name}`}
                      >
                        <Text
                          style={[
                            styles.productChipText,
                            editProductId === p.id && styles.productChipTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.priceInput}
                      value={editPrice}
                      onChangeText={setEditPrice}
                      placeholder="Price"
                      keyboardType="decimal-pad"
                      accessibilityLabel="Override price"
                    />
                    <Pressable
                      style={styles.addOverrideBtn}
                      onPress={handleAddOverride}
                      accessibilityLabel="Add price override"
                    >
                      <Text style={styles.addOverrideBtnText}>Add</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Text style={styles.overrideEmpty}>No products in catalog.</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Totals modal shown after closing */}
      <TotalsModal
        visible={showTotals}
        totals={totals}
        concertName={concert.name}
        onClose={() => setShowTotals(false)}
      />
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: { padding: 12, gap: 12 },
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
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: { fontSize: 14, color: '#888', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#1a1a1a', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeClosed: { backgroundColor: '#f3f4f6' },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextActive: { color: '#16a34a' },
  badgeTextClosed: { color: '#6b7280' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  totalCell: { alignItems: 'center', gap: 4 },
  totalCellValue: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  totalCellLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionsCard: {
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
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  actionBtnPrimary: { backgroundColor: '#208AEF' },
  actionBtnDanger: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
  actionBtnSecondary: { backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  actionBtnPressed: { opacity: 0.85 },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnTextPrimary: { color: '#fff', fontSize: 16, fontWeight: '700' },
  actionBtnTextDanger: { color: '#dc2626', fontSize: 16, fontWeight: '700' },
  actionBtnTextSecondary: { color: '#208AEF', fontSize: 16, fontWeight: '700' },
  overrideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editPricesBtn: { color: '#208AEF', fontSize: 14, fontWeight: '600' },
  overrideEmpty: { fontSize: 13, color: '#888', textAlign: 'center', paddingVertical: 8 },
  overrideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  overrideInfo: { flex: 1, gap: 2 },
  overrideName: { fontSize: 14, color: '#1a1a1a', fontWeight: '600' },
  overridePrice: { fontSize: 13, color: '#666' },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  deleteBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  addOverrideForm: { gap: 8, paddingTop: 8 },
  addOverrideLabel: { fontSize: 12, color: '#888', fontWeight: '600', textTransform: 'uppercase' },
  overrideFormRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  productChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    marginBottom: 6,
  },
  productChipSelected: { backgroundColor: '#EBF4FF', borderWidth: 1, borderColor: '#208AEF' },
  productChipText: { fontSize: 13, color: '#444' },
  productChipTextSelected: { color: '#208AEF', fontWeight: '700' },
  priceInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    backgroundColor: '#fafafa',
    marginBottom: 8,
    minHeight: 44,
  },
  addOverrideBtn: {
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addOverrideBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 16,
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: -8 },
  totalsGrid: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', paddingVertical: 8 },
  totalItem: { alignItems: 'center', gap: 4 },
  totalValue: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  totalLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalBtn: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

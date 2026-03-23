import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHistory } from '@/features/history/useHistory';
import { useTheme } from '@/hooks/use-theme';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatConcertDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type SaleItem = {
  productId: string;
  variantSku: string;
  quantity: number;
  priceAtSale: number;
};

interface SaleRowItem {
  id: string;
  concertId: string;
  items_json: string;
  totalAmount: number;
  paymentMethod: string;
  currency: string;
  discount: number;
  discountType: string;
  voided: number;
  voided_at: number | null;
  synced: number;
  created_at: number;
  parsedItems: SaleItem[];
}

function SaleRow({ sale, onPress }: { sale: SaleRowItem; onPress: () => void }) {
  const c = useTheme();
  const raw = sale as unknown as { total_amount?: number; payment_method?: string };
  const itemCount = sale.parsedItems.reduce((sum, i) => sum + i.quantity, 0);
  const total = raw.total_amount ?? sale.totalAmount;
  const paymentMethod = raw.payment_method ?? sale.paymentMethod;
  const isVoided = sale.voided === 1;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.saleRow,
        { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder },
        pressed && styles.saleRowPressed,
        isVoided && styles.saleRowVoided,
      ]}
      onPress={onPress}
      accessibilityLabel={`Sale from ${formatTimestamp(sale.created_at)}`}
    >
      <View style={styles.saleInfo}>
        <Text style={[styles.saleTime, { color: c.text }, isVoided && styles.saleTextVoided]}>
          {formatTimestamp(sale.created_at)}
        </Text>
        <Text style={[styles.saleMeta, { color: c.textSecondary }, isVoided && styles.saleTextVoided]}>
          {`${itemCount} item${itemCount !== 1 ? 's' : ''} · ${paymentMethod}`}
        </Text>
      </View>
      <View style={styles.saleRight}>
        {isVoided && (
          <View style={styles.voidedBadge}>
            <Text style={styles.voidedBadgeText}>VOIDED</Text>
          </View>
        )}
        <Text style={[styles.saleTotal, { color: c.text }, isVoided && styles.saleTextVoided]}>
          {`${sale.currency} ${(total ?? 0).toFixed(2)}`}
        </Text>
      </View>
    </Pressable>
  );
}

interface ConcertSection {
  concertId: string;
  concertName: string;
  concertDate?: number;
  data: SaleRowItem[];
}

export default function HistoryScreen() {
  const c = useTheme();
  const { salesByGroup, concertNames, allConcertIds, loading, loadHistory } = useHistory();
  const [filter, setFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // Reload on filter change
  useEffect(() => {
    loadHistory(filter ?? undefined);
  }, [loadHistory, filter]);

  // Reload when screen gains focus (e.g., after making a new sale)
  useFocusEffect(
    useCallback(() => {
      loadHistory(filter ?? undefined);
    }, [loadHistory, filter])
  );

  const handleRefresh = useCallback(async () => {
    await loadHistory(filter ?? undefined);
  }, [loadHistory, filter]);

  // Build sections for SectionList
  const sections: ConcertSection[] = Object.entries(salesByGroup).map(([concertId, sales]) => ({
    concertId,
    concertName: concertNames[concertId] ?? (concertId || 'No concert'),
    data: sales as SaleRowItem[],
  }));

  // Sort sections by newest sale in each concert
  sections.sort((a, b) => {
    const aTop = a.data[0]?.created_at ?? 0;
    const bTop = b.data[0]?.created_at ?? 0;
    return bTop - aTop;
  });

  // Get unique concerts for filter dropdown — use allConcertIds so options
  // stay stable when a filter is active (salesByGroup only has filtered data).
  const concertOptions = allConcertIds.map((id) => ({
    id,
    name: concertNames[id] ?? (id || 'No concert'),
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.headerBg, borderBottomColor: c.border }]}>
        <Text style={[styles.headerTitle, { color: c.text }]}>Transaction History</Text>
      </View>

      {/* Concert filter */}
      <View style={[styles.filterBar, { backgroundColor: c.headerBg, borderBottomColor: c.border }]}>
        <Pressable
          style={[styles.filterBtn, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}
          onPress={() => setFilterOpen((v) => !v)}
          accessibilityLabel="Filter by concert"
        >
          <Text style={[styles.filterBtnText, { color: c.text }]}>
            {filter !== null ? (concertNames[filter] ?? (filter || 'No concert')) : 'All Concerts'}
          </Text>
          <Text style={[styles.filterBtnChevron, { color: c.textSecondary }]}>{filterOpen ? '▲' : '▼'}</Text>
        </Pressable>
        {filter !== null && (
          <Pressable
            onPress={() => setFilter(null)}
            style={styles.clearFilterBtn}
            accessibilityLabel="Clear filter"
          >
            <Text style={[styles.clearFilterText, { color: c.accent }]}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Filter dropdown */}
      {filterOpen && (
        <View style={[styles.filterDropdown, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderBottomColor: c.border }]}>
          <Pressable
            style={[styles.filterOption, filter === null && styles.filterOptionSelected]}
            onPress={() => { setFilter(null); setFilterOpen(false); }}
            accessibilityLabel="All Concerts"
          >
            <Text style={[styles.filterOptionText, { color: c.text }, filter === null && styles.filterOptionTextSelected]}>
              All Concerts
            </Text>
          </Pressable>
          {concertOptions.map((opt) => (
            <Pressable
              key={opt.id}
              style={[styles.filterOption, filter === opt.id && styles.filterOptionSelected]}
              onPress={() => { setFilter(opt.id); setFilterOpen(false); }}
              accessibilityLabel={opt.name}
            >
              <Text
                style={[
                  styles.filterOptionText,
                  { color: c.text },
                  filter === opt.id && styles.filterOptionTextSelected,
                ]}
              >
                {opt.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {loading && sections.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>{'📋'}</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>No transactions yet</Text>
          <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>
            Completed sales will appear here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SaleRow
              sale={item}
              onPress={() => router.push(`/history/${item.id}` as never)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={{ height: 3, backgroundColor: c.textSecondary, borderRadius: 1.5, marginBottom: 10 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={[styles.sectionHeaderTitle, { color: c.text }]}>{section.concertName}</Text>
                {section.data[0]?.created_at && (
                  <Text style={[styles.sectionHeaderDate, { color: c.textSecondary }]}>
                    {formatConcertDate(section.data[0].created_at)}
                  </Text>
                )}
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border, marginVertical: 4, marginHorizontal: 4 }} />}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
  },
  filterBtnText: { fontSize: 14, color: '#333', fontWeight: '500' },
  filterBtnChevron: { fontSize: 12, color: '#888' },
  clearFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearFilterText: { fontSize: 14, color: '#208AEF', fontWeight: '600' },
  filterDropdown: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 4,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterOptionSelected: {
    backgroundColor: '#EBF4FF',
  },
  filterOptionText: { fontSize: 14, color: '#333' },
  filterOptionTextSelected: { color: '#208AEF', fontWeight: '700' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
  },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center' },
  listContent: { padding: 12, paddingBottom: 24 },
  sectionHeader: {
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sectionHeaderDate: {
    fontSize: 12,
    color: '#888',
  },
  saleRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  saleRowPressed: { opacity: 0.85 },
  saleRowVoided: { opacity: 0.65 },
  saleInfo: { flex: 1, gap: 2 },
  saleTime: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  saleMeta: { fontSize: 12, color: '#888' },
  saleTextVoided: { color: '#bbb' },
  saleRight: { alignItems: 'flex-end', gap: 4 },
  voidedBadge: {
    backgroundColor: '#fee2e2',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  voidedBadgeText: { fontSize: 10, fontWeight: '700', color: '#dc2626' },
  saleTotal: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  separator: { height: 6 },
});

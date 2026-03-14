import { router } from 'expo-router';
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
  const itemCount = sale.parsedItems.reduce((sum, i) => sum + i.quantity, 0);
  const total = (sale as unknown as { total_amount?: number }).total_amount ?? sale.totalAmount;
  const isVoided = sale.voided === 1;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.saleRow,
        pressed && styles.saleRowPressed,
        isVoided && styles.saleRowVoided,
      ]}
      onPress={onPress}
      accessibilityLabel={`Sale from ${formatTimestamp(sale.created_at)}`}
    >
      <View style={styles.saleInfo}>
        <Text style={[styles.saleTime, isVoided && styles.saleTextVoided]}>
          {formatTimestamp(sale.created_at)}
        </Text>
        <Text style={[styles.saleMeta, isVoided && styles.saleTextVoided]}>
          {`${itemCount} item${itemCount !== 1 ? 's' : ''} · ${sale.paymentMethod}`}
        </Text>
      </View>
      <View style={styles.saleRight}>
        {isVoided && (
          <View style={styles.voidedBadge}>
            <Text style={styles.voidedBadgeText}>VOIDED</Text>
          </View>
        )}
        <Text style={[styles.saleTotal, isVoided && styles.saleTextVoided]}>
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
  const { salesByGroup, concertNames, loading, loadHistory } = useHistory();
  const [filter, setFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    loadHistory(filter ?? undefined);
  }, [loadHistory, filter]);

  const handleRefresh = useCallback(async () => {
    await loadHistory(filter ?? undefined);
  }, [loadHistory, filter]);

  // Build sections for SectionList
  const sections: ConcertSection[] = Object.entries(salesByGroup).map(([concertId, sales]) => ({
    concertId,
    concertName: concertNames[concertId] ?? concertId,
    data: sales as SaleRowItem[],
  }));

  // Sort sections by newest sale in each concert
  sections.sort((a, b) => {
    const aTop = a.data[0]?.created_at ?? 0;
    const bTop = b.data[0]?.created_at ?? 0;
    return bTop - aTop;
  });

  // Get unique concerts for filter dropdown
  const concertOptions = Object.keys(salesByGroup).map((id) => ({
    id,
    name: concertNames[id] ?? id,
  }));

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transaction History</Text>
      </View>

      {/* Concert filter */}
      <View style={styles.filterBar}>
        <Pressable
          style={styles.filterBtn}
          onPress={() => setFilterOpen((v) => !v)}
          accessibilityLabel="Filter by concert"
        >
          <Text style={styles.filterBtnText}>
            {filter ? (concertNames[filter] ?? filter) : 'All Concerts'}
          </Text>
          <Text style={styles.filterBtnChevron}>{filterOpen ? '▲' : '▼'}</Text>
        </Pressable>
        {filter && (
          <Pressable
            onPress={() => setFilter(null)}
            style={styles.clearFilterBtn}
            accessibilityLabel="Clear filter"
          >
            <Text style={styles.clearFilterText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Filter dropdown */}
      {filterOpen && (
        <View style={styles.filterDropdown}>
          <Pressable
            style={[styles.filterOption, !filter && styles.filterOptionSelected]}
            onPress={() => { setFilter(null); setFilterOpen(false); }}
            accessibilityLabel="All Concerts"
          >
            <Text style={[styles.filterOptionText, !filter && styles.filterOptionTextSelected]}>
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
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>{'📋'}</Text>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptySubtitle}>
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
              <Text style={styles.sectionHeaderTitle}>{section.concertName}</Text>
              {section.data[0]?.created_at && (
                <Text style={styles.sectionHeaderDate}>
                  {formatConcertDate(section.data[0].created_at)}
                </Text>
              )}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
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

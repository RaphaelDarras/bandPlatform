import { router, useIsFocused } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CachedConcert } from '@/db/concerts';
import { useConcerts } from '@/features/concerts/useConcerts';
import { useTheme } from '@/hooks/use-theme';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ConcertRow({ concert }: { concert: CachedConcert }) {
  const c = useTheme();
  const isActive = concert.active === 1;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border }, pressed && styles.rowPressed]}
      onPress={() => router.push(`/concerts/${concert.id}` as never)}
      accessibilityLabel={[concert.venue, concert.city, concert.country].filter(Boolean).join(' · ') || 'Concert'}
    >
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: c.text }]}>
          {[concert.venue, concert.city, concert.country].filter(Boolean).join(' · ')}
        </Text>
        <Text style={[styles.rowMeta, { color: c.textSecondary }]}>
          {concert.city ?? ''}
        </Text>
        <Text style={[styles.rowDate, { color: c.textSecondary }]}>{formatDate(concert.date)}</Text>
      </View>
      <View
        style={[styles.badge, isActive ? styles.badgeActive : [styles.badgeClosed, { backgroundColor: c.backgroundElement }]]}
      >
        <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextClosed]}>
          {isActive ? 'Active' : 'Closed'}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ConcertListScreen() {
  const c = useTheme();
  const { concerts, loading, loadConcerts } = useConcerts();
  const isFocused = useIsFocused();
  const [selectedTab, setSelectedTab] = useState<'active' | 'closed'>('active');

  useEffect(() => {
    if (isFocused) {
      loadConcerts();
    }
  }, [isFocused, loadConcerts]);

  const handleRefresh = useCallback(async () => {
    await loadConcerts();
  }, [loadConcerts]);

  const activeConcerts = useMemo(
    () => concerts.filter((concert) => concert.active === 1),
    [concerts],
  );
  const closedConcerts = useMemo(
    () => concerts.filter((concert) => concert.active === 0),
    [concerts],
  );
  const visibleConcerts = selectedTab === 'active' ? activeConcerts : closedConcerts;

  if (loading && concerts.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.headerBg, borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: c.accent }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]}>Concerts</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/concerts/new' as never)}
          accessibilityLabel="New Concert"
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </Pressable>
      </View>

      {/* Active/Closed tab row */}
      <View style={[styles.tabRow, { backgroundColor: c.headerBg, borderBottomColor: c.border }]}>
        <Pressable
          onPress={() => setSelectedTab('active')}
          style={[
            styles.tabPill,
            selectedTab === 'active'
              ? { backgroundColor: c.accent }
              : { backgroundColor: c.backgroundElement },
          ]}
          accessibilityLabel={`Active concerts, ${activeConcerts.length}`}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedTab === 'active' }}
        >
          <Text
            style={[
              styles.tabPillText,
              { color: selectedTab === 'active' ? '#fff' : c.textSecondary },
            ]}
          >
            {`Active (${activeConcerts.length})`}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedTab('closed')}
          style={[
            styles.tabPill,
            selectedTab === 'closed'
              ? { backgroundColor: c.accent }
              : { backgroundColor: c.backgroundElement },
          ]}
          accessibilityLabel={`Closed concerts, ${closedConcerts.length}`}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedTab === 'closed' }}
        >
          <Text
            style={[
              styles.tabPillText,
              { color: selectedTab === 'closed' ? '#fff' : c.textSecondary },
            ]}
          >
            {`Closed (${closedConcerts.length})`}
          </Text>
        </Pressable>
      </View>

      {visibleConcerts.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>{'🎤'}</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>
            {selectedTab === 'active' ? 'No active concerts' : 'No closed concerts yet'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>
            {selectedTab === 'active'
              ? 'Tap "+ New" to create your first concert.'
              : 'Closed concerts will appear here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleConcerts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConcertRow concert={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 3, backgroundColor: c.textSecondary, marginVertical: 10, borderRadius: 1.5 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
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
  backButton: { width: 60 },
  backText: { color: '#208AEF', fontSize: 15 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  addButton: {
    backgroundColor: '#208AEF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  listContent: {
    padding: 12,
  },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowInfo: {
    flex: 1,
    gap: 3,
    marginRight: 12,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  rowMeta: {
    fontSize: 13,
    color: '#666',
  },
  rowDate: {
    fontSize: 12,
    color: '#888',
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: '#dcfce7',
  },
  badgeClosed: {
    backgroundColor: '#f3f4f6',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: '#16a34a',
  },
  badgeTextClosed: {
    color: '#6b7280',
  },
  separator: {
    height: 8,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 96,
    alignItems: 'center',
  },
  tabPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiClient } from '@/api/client';
import { getDb } from '@/db';
import { requestSync } from '@/features/sync/SyncManager';
import { useConcerts } from '@/features/concerts/useConcerts';
import { useHistory } from '@/features/history/useHistory';
import { useStock } from '@/features/stock/useStock';
import { useTheme } from '@/hooks/use-theme';
import { useSyncStore } from '@/stores/syncStore';
import { formatRelativeTime } from '@/utils/formatRelativeTime';

interface ActionCard {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  primary?: boolean;
  badge?: number;
  badgeColor?: string;
  alert?: boolean;
  disabled?: boolean;
}

function SyncIndicator({ onSync }: { onSync: () => Promise<void> }) {
  const c = useTheme();
  const { isOnline, pendingCount, lastSyncAt, consecutiveFailures } = useSyncStore();
  const [syncing, setSyncing] = useState(false);

  const color = !isOnline ? '#ef4444'
    : (pendingCount > 0 || consecutiveFailures > 0) ? '#f59e0b'
    : '#22c55e';

  const { t } = useTranslation();
  const statusLabel = !isOnline ? t('sync.offline') : pendingCount > 0 ? t('sync.pending', { count: pendingCount }) : 'Online';
  const lastSyncLabel = lastSyncAt ? formatRelativeTime(lastSyncAt) : '';
  const fullLabel = lastSyncLabel ? `${statusLabel} · ${lastSyncLabel}` : statusLabel;

  const handleSyncNow = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  }, [syncing, onSync]);

  return (
    <View style={styles.syncRow}>
      <View style={[styles.syncDot, { backgroundColor: color }]} />
      <Text style={[styles.syncLabel, { color: c.textSecondary }]}>{fullLabel}</Text>
      <Pressable
        onPress={handleSyncNow}
        disabled={syncing}
        accessibilityLabel="Sync now"
        style={styles.syncNowBtn}
      >
        {syncing
          ? <ActivityIndicator size="small" color="#888" />
          : <Text style={[styles.syncNowIcon, { color: c.textSecondary }]}>{'↻'}</Text>
        }
      </Pressable>
    </View>
  );
}

function ActionCardItem({ card }: { card: ActionCard }) {
  const c = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder },
        card.primary && styles.cardPrimary,
        card.alert && styles.cardAlert,
        card.disabled && [styles.cardDisabled, { backgroundColor: c.backgroundElement }],
        pressed && !card.disabled && styles.cardPressed,
      ]}
      onPress={card.disabled ? undefined : card.onPress}
      accessibilityLabel={card.title}
      disabled={card.disabled}
    >
      <View style={styles.cardIcon}>
        <Text style={styles.cardIconText}>{card.icon}</Text>
        {card.badge !== undefined && card.badge > 0 && (
          <View style={[styles.badge, { backgroundColor: card.badgeColor ?? '#ef4444' }]}>
            <Text style={styles.badgeText}>{card.badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.cardTitle, { color: c.text }, card.primary && styles.cardTitlePrimary]}>
        {card.title}
      </Text>
      {card.subtitle && (
        <Text style={[styles.cardSubtitle, { color: c.textSecondary }]}>{card.subtitle}</Text>
      )}
    </Pressable>
  );
}

export default function DashboardScreen() {
  const c = useTheme();
  const { t } = useTranslation();
  const { products, needsReproduction, refreshStock } = useStock();
  const { loadConcerts } = useConcerts();
  const { pullFromServer } = useHistory();

  useFocusEffect(
    useCallback(() => {
      refreshStock();
    }, [refreshStock])
  );

  const handleFullSync = useCallback(async () => {
    const db = await getDb();
    await Promise.all([
      requestSync(db, apiClient),
      refreshStock(),
      loadConcerts(),
      pullFromServer(),
    ]);
  }, [refreshStock, loadConcerts, pullFromServer]);

  const hasProducts = products.length > 0;

  const actionCards: ActionCard[] = [
    {
      id: 'selling',
      title: t('dashboard.startSelling'),
      subtitle: hasProducts
        ? t('dashboard.startSellingSubtitle')
        : t('dashboard.startSellingDisabled'),
      icon: '🎸',
      onPress: hasProducts ? () => router.push('/selling' as never) : () => {},
      primary: true,
      disabled: !hasProducts,
    },
    {
      id: 'concerts',
      title: t('dashboard.concertManagement'),
      subtitle: t('dashboard.concertManagementSubtitle'),
      icon: '🎤',
      onPress: () => router.push('/concerts' as never),
    },
    {
      id: 'deficit',
      title: t('dashboard.needsRestock'),
      subtitle: t('dashboard.needsRestockSubtitle'),
      icon: '⚠️',
      onPress: () => router.push('/deficit' as never),
      badge: needsReproduction.length,
      badgeColor: '#ef4444',
      alert: needsReproduction.length > 0,
    },
    {
      id: 'restock',
      title: t('dashboard.restock'),
      subtitle: t('dashboard.restockSubtitle'),
      icon: '📥',
      onPress: () => router.push('/restock' as never),
    },
    {
      id: 'products',
      title: t('dashboard.manageProducts'),
      subtitle: t('dashboard.manageProductsSubtitle'),
      icon: '🏷️',
      onPress: () => router.push('/products' as never),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.headerRow, { backgroundColor: c.headerBg, borderBottomColor: c.border }]}>
        <Text style={[styles.headerTitle, { color: c.text }]}>Hurakan Merch</Text>
        <SyncIndicator onSync={handleFullSync} />
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {/* Primary card — full width */}
        <ActionCardItem card={actionCards[0]} />

        {/* Remaining cards — 2-column grid */}
        <View style={styles.twoColumn}>
          {actionCards.slice(1).map((card) => (
            <View key={card.id} style={styles.columnItem}>
              <ActionCardItem card={card} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncLabel: {
    fontSize: 12,
    color: '#666',
  },
  syncNowBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  syncNowIcon: {
    fontSize: 16,
    color: '#666',
  },
  grid: {
    padding: 12,
    gap: 12,
  },
  twoColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  columnItem: {
    width: '47%',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: 4,
  },
  cardPrimary: {
    backgroundColor: '#208AEF',
  },
  cardAlert: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  cardDisabled: {
    opacity: 0.5,
    backgroundColor: '#e5e7eb',
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardIcon: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  cardIconText: {
    fontSize: 28,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  cardTitlePrimary: {
    color: '#fff',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#888',
  },
});

import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSyncStore } from '@/stores/syncStore';

interface ActionCard {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  primary?: boolean;
  badge?: number;
  badgeColor?: string;
}

function SyncIndicator() {
  const { isOnline, pendingCount } = useSyncStore();

  const color = !isOnline ? '#ef4444' : pendingCount > 0 ? '#f59e0b' : '#22c55e';
  const label = !isOnline ? 'Offline' : pendingCount > 0 ? `${pendingCount} pending` : 'Online';

  return (
    <View style={styles.syncRow}>
      <View style={[styles.syncDot, { backgroundColor: color }]} />
      <Text style={styles.syncLabel}>{label}</Text>
    </View>
  );
}

function ActionCardItem({ card }: { card: ActionCard }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        card.primary && styles.cardPrimary,
        pressed && styles.cardPressed,
      ]}
      onPress={card.onPress}
      accessibilityLabel={card.title}
    >
      <View style={styles.cardIcon}>
        <Text style={styles.cardIconText}>{card.icon}</Text>
        {card.badge !== undefined && card.badge > 0 && (
          <View style={[styles.badge, { backgroundColor: card.badgeColor ?? '#ef4444' }]}>
            <Text style={styles.badgeText}>{card.badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.cardTitle, card.primary && styles.cardTitlePrimary]}>
        {card.title}
      </Text>
      {card.subtitle && (
        <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
      )}
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { t } = useTranslation();

  const actionCards: ActionCard[] = [
    {
      id: 'selling',
      title: 'Start Selling',
      subtitle: 'Open the selling screen',
      icon: '🎸',
      onPress: () => router.push('/selling' as never),
      primary: true,
    },
    {
      id: 'concerts',
      title: 'Concert Management',
      subtitle: 'Manage active concerts',
      icon: '🎤',
      onPress: () => router.push('/concerts' as never),
    },
    {
      id: 'history',
      title: 'Transaction History',
      subtitle: 'View past sales',
      icon: '📋',
      onPress: () => router.push('/(tabs)/history' as never),
    },
    {
      id: 'stock',
      title: 'Stock Overview',
      subtitle: 'Check inventory levels',
      icon: '📦',
      onPress: () => router.push('/(tabs)/stock' as never),
    },
    {
      id: 'deficit',
      title: 'Needs Restock',
      subtitle: 'Items with negative stock',
      icon: '⚠️',
      onPress: () => router.push('/restock' as never),
      badge: 0,
      badgeColor: '#ef4444',
    },
    {
      id: 'restock',
      title: 'Restock',
      subtitle: 'Add inventory',
      icon: '📥',
      onPress: () => router.push('/restock' as never),
    },
    {
      id: 'products',
      title: 'Manage Products',
      subtitle: 'Edit catalog',
      icon: '🏷️',
      onPress: () => router.push('/products' as never),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>BandPOS</Text>
        <SyncIndicator />
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

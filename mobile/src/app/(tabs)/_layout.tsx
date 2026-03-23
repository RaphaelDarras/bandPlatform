import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/use-theme';
import { useCartStore } from '@/stores/cartStore';

/**
 * JS Tabs layout (NOT NativeTabs — per research, NativeTabs is alpha and cannot hide tab bar).
 * Tab bar is hidden when a concert is active (selling mode).
 */
export default function TabsLayout() {
  const c = useTheme();
  const { t } = useTranslation();
  const concertId = useCartStore((state) => state.concertId);
  const cartItems = useCartStore((state) => state.items);
  const isSellingMode = concertId !== null && cartItems.length > 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: isSellingMode
          ? { display: 'none' as const }
          : { backgroundColor: c.headerBg, borderTopColor: c.border },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.dashboard'),
          tabBarLabel: t('tabs.dashboard'),
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size * 0.9, color }}>{'⬜'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.history'),
          tabBarLabel: t('tabs.history'),
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size * 0.9, color }}>{'📋'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: t('tabs.stock'),
          tabBarLabel: t('tabs.stock'),
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size * 0.9, color }}>{'📦'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarLabel: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size * 0.9, color }}>{'⚙️'}</Text>
          ),
        }}
      />
    </Tabs>
  );
}

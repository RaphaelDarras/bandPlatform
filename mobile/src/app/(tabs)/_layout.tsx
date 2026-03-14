import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCartStore } from '@/stores/cartStore';

/**
 * JS Tabs layout (NOT NativeTabs — per research, NativeTabs is alpha and cannot hide tab bar).
 * Tab bar is hidden when a concert is active (selling mode).
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const concertId = useCartStore((state) => state.concertId);
  const isSellingMode = concertId !== null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: isSellingMode ? { display: 'none' } : undefined,
        tabBarActiveTintColor: '#208AEF',
        tabBarInactiveTintColor: '#888',
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

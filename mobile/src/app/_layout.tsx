import { Redirect, Slot, Stack } from 'expo-router';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import React from 'react';
import { useEffect, useState } from 'react';
import { Appearance, AppState, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { SQLiteDatabase } from 'expo-sqlite';

import { useAuthStore } from '@/stores/authStore';
import { getDb } from '@/db';
import { apiClient } from '@/api/client';
import { useConnectivitySync } from '@/features/sync/useConnectivity';
import { startPeriodicSync, stopPeriodicSync, requestSync } from '@/features/sync/SyncManager';
import '@/i18n';
import '@/global.css';

// Default to dark mode — concert venues are dark
Appearance.setColorScheme('dark');

export default function RootLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const colorScheme = useColorScheme();
  const [db, setDb] = useState<SQLiteDatabase | null>(null);

  useEffect(() => {
    getDb().then(setDb);
  }, []);

  useEffect(() => {
    if (!db) return;
    startPeriodicSync(db, apiClient);
    return () => stopPeriodicSync();
  }, [db]);

  // When the app returns to the foreground, re-validate the DB connection
  // and kick off a sync so stock stays in sync with the backend.
  useEffect(() => {
    if (!db) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        requestSync(db, apiClient);
      }
    });
    return () => sub.remove();
  }, [db]);

  useConnectivitySync(db, apiClient);

  const isDark = colorScheme === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#f8f9fa' }}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <SafeAreaProvider>
          {isAuthenticated ? (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          ) : (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack>
          )}
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

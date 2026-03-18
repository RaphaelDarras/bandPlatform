import { Redirect, Slot, Stack } from 'expo-router';
import React from 'react';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
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

export default function RootLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        {!isAuthenticated && <Redirect href="/(auth)/pin" />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

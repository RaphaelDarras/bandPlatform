import { Redirect, Slot, Stack } from 'expo-router';
import React from 'react';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import '@/i18n';
import '@/global.css';

export default function RootLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      useSyncStore.getState().setIsOnline(online);
    });
    return unsubscribe;
  }, []);

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

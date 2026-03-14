import { Redirect, Slot, Stack } from 'expo-router';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '@/stores/authStore';
import '@/i18n';
import '@/global.css';

export default function RootLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

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

import { router, Stack, useSegments } from 'expo-router';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { useCartStore } from '@/stores/cartStore';
import { CartBar } from '@/features/cart/CartBar';

/**
 * Selling mode stack layout.
 * - Back button exits selling mode: clears concertId, navigates back to tabs
 * - CartBar renders at bottom on all selling screens except the review screen
 */
export default function SellingLayout() {
  const setConcertId = useCartStore((state) => state.setConcertId);
  const segments = useSegments();
  const isOnReview = segments[segments.length - 1] === 'review';

  const clearCart = useCartStore((state) => state.clearCart);
  const setCurrency = useCartStore((state) => state.setCurrency);

  const handleExit = () => {
    clearCart();
    setConcertId(null);
    setCurrency('EUR');
    router.back();
  };

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: '#208AEF' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          headerLeft: () => (
            <Pressable
              onPress={handleExit}
              accessibilityLabel="Exit selling mode"
              style={{ paddingHorizontal: 4 }}
            >
              <Text style={{ color: '#fff', fontSize: 24 }}>{'←'}</Text>
            </Pressable>
          ),
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'Selling' }}
        />
        <Stack.Screen
          name="review"
          options={{ title: 'Review Sale' }}
        />
      </Stack>

      {!isOnReview && <CartBar />}
    </>
  );
}

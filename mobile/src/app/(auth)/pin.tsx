import { router } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/useAuth';
import { getCachedToken } from '@/features/auth/pinAuth';
import { useSyncStore } from '@/stores/syncStore';

const MAX_PIN_LENGTH = 6;
const MIN_PIN_LENGTH = 4;

const KEYPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'DEL'],
];

export default function PinScreen() {
  const { t } = useTranslation();
  const { login, isLoading } = useAuth();
  const { isOnline } = useSyncStore();
  const [pin, setPin] = useState('');
  const [offlineNoCache, setOfflineNoCache] = useState(false);

  // Check if offline and no cached token (cold-start offline)
  React.useEffect(() => {
    if (!isOnline) {
      getCachedToken().then((token) => {
        if (!token) setOfflineNoCache(true);
      });
    } else {
      setOfflineNoCache(false);
    }
  }, [isOnline]);

  function handleKeyPress(key: string) {
    if (key === 'DEL') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    if (pin.length >= MAX_PIN_LENGTH) return;
    const newPin = pin + key;
    setPin(newPin);
    if (newPin.length >= MIN_PIN_LENGTH) {
      handleSubmit(newPin);
    }
  }

  async function handleSubmit(pinValue: string) {
    try {
      await login(pinValue);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.loginFailed');
      Alert.alert(t('common.error'), message);
      setPin('');
    }
  }

  if (offlineNoCache) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineTitle}>{t('auth.needOnlineFirst')}</Text>
          <Pressable
            style={styles.retryButtonWrapper}
            onPress={() => setOfflineNoCache(false)}
          >
            {({ pressed }) => (
              <View style={[styles.retryButton, pressed && { opacity: 0.85 }]}>
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>{t('appName')}</Text>
        <Text style={styles.prompt}>{t('auth.enterPin')}</Text>
      </View>

      {/* PIN dots */}
      <View style={styles.dotsContainer}>
        {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length ? styles.dotFilled : styles.dotEmpty,
            ]}
          />
        ))}
      </View>

      {/* Numeric keypad */}
      <View style={styles.keypad}>
        {KEYPAD_KEYS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.keyRow}>
            {row.map((key, colIdx) => {
              if (key === '') {
                return <View key={colIdx} style={styles.keyEmpty} />;
              }
              return (
                <Pressable
                  key={colIdx}
                  style={({ pressed }) => [
                    styles.key,
                    pressed && styles.keyPressed,
                    isLoading && styles.keyDisabled,
                  ]}
                  onPress={() => handleKeyPress(key)}
                  disabled={isLoading}
                  accessibilityLabel={key === 'DEL' ? 'Delete' : key}
                >
                  <Text style={styles.keyText}>{key === 'DEL' ? '\u232B' : key}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 24 : 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  prompt: {
    fontSize: 16,
    color: '#666',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 24,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#208AEF',
  },
  dotFilled: {
    backgroundColor: '#208AEF',
  },
  dotEmpty: {
    backgroundColor: 'transparent',
  },
  keypad: {
    paddingHorizontal: 32,
    gap: 12,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  key: {
    flex: 1,
    aspectRatio: 1.5,
    backgroundColor: '#f0f0f3',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    backgroundColor: '#d0d0d8',
  },
  keyDisabled: {
    opacity: 0.5,
  },
  keyEmpty: {
    flex: 1,
    aspectRatio: 1.5,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  offlineContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 24,
  },
  offlineTitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#444',
    lineHeight: 26,
  },
  retryButtonWrapper: { borderRadius: 8, overflow: 'hidden' },
  retryButton: {
    backgroundColor: '#208AEF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

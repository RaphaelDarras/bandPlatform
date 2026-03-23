import { router } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Appearance,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/useAuth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import i18n from '@/i18n';

const APP_VERSION = '1.0.0';

function SettingRow({
  label,
  labelColor,
  right,
}: {
  label: string;
  labelColor?: string;
  right: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, labelColor ? { color: labelColor } : undefined]}>{label}</Text>
      <View>{right}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const colorScheme = useColorScheme();
  const c = useTheme();
  const [isDark, setIsDark] = useState(() => colorScheme === 'dark');
  const [isFrench, setIsFrench] = useState(() => (i18n.language ?? 'en').startsWith('fr'));

  function handleLanguageToggle(value: boolean) {
    const lang = value ? 'fr' : 'en';
    i18n.changeLanguage(lang);
    setIsFrench(value);
  }

  function handleThemeToggle(value: boolean) {
    Appearance.setColorScheme(value ? 'dark' : 'light');
    setIsDark(value);
  }

  function handleLogout() {
    Alert.alert(
      t('auth.logout'),
      t('settings.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(auth)/pin');
          },
        },
      ]
    );
  }

  const bg = isDark ? '#121212' : '#f8f9fa';

  const textColor = isDark ? '#e0e0e0' : '#1a1a1a';
  const secondaryText = isDark ? '#999' : '#888';
  const borderColor = isDark ? '#333' : '#eee';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: textColor }]}>{t('tabs.settings')}</Text>

        {/* Language */}
        <View style={[styles.section, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
          <Text style={[styles.sectionHeader, { color: secondaryText }]}>{t('settings.language')}</Text>
          <SettingRow
            label={t('settings.french')}
            labelColor={textColor}
            right={
              <Switch
                value={isFrench}
                onValueChange={handleLanguageToggle}
                trackColor={{ true: '#208AEF', false: isDark ? '#555' : '#ccc' }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
              />
            }
          />
        </View>

        {/* Theme */}
        <View style={[styles.section, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
          <Text style={[styles.sectionHeader, { color: secondaryText }]}>{t('settings.appearance')}</Text>
          <SettingRow
            label={t('settings.darkMode')}
            labelColor={textColor}
            right={
              <Switch
                value={isDark}
                onValueChange={handleThemeToggle}
                trackColor={{ true: '#208AEF', false: isDark ? '#555' : '#ccc' }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
              />
            }
          />
        </View>

        {/* Security */}
        <View style={[styles.section, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
          <Text style={[styles.sectionHeader, { color: secondaryText }]}>{t('settings.security')}</Text>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowPressable, pressed && styles.rowPressed]}
            onPress={() => router.push('/change-pin' as never)}
          >
            <Text style={[styles.rowLabel, { color: textColor }]}>{t('settings.changePin')}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        {/* Info */}
        <View style={[styles.section, { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder }]}>
          <Text style={[styles.sectionHeader, { color: secondaryText }]}>{t('settings.about')}</Text>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: textColor }]}>{t('settings.version')}</Text>
            <Text style={[styles.rowValue, { color: secondaryText }]}>{APP_VERSION}</Text>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutPressed]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>{t('auth.logout')}</Text>
          </Pressable>
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
  scroll: {
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  rowPressable: {},
  rowPressed: {
    backgroundColor: '#f0f0f3',
  },
  rowLabel: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  rowValue: {
    fontSize: 14,
    color: '#888',
  },
  chevron: {
    fontSize: 20,
    color: '#bbb',
  },
  logoutButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutPressed: {
    backgroundColor: '#fff0f0',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
});

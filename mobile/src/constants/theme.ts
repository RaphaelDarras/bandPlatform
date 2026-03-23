/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1a1a1a',
    background: '#f8f9fa',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#888',
    card: '#fff',
    border: '#e0e0e0',
    headerBg: '#fff',
    accent: '#208AEF',
    danger: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    inputBg: '#fafafa',
    inputBorder: '#ddd',
    rowPressed: '#f0f0f3',
    trackFalse: '#ccc',
    modalOverlay: 'rgba(0,0,0,0.4)',
    badgeBg: '#e8f0fe',
    cardBorder: 'transparent',
  },
  dark: {
    text: '#e0e0e0',
    background: '#121212',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#999',
    card: '#1e1e1e',
    border: '#4a4a4a',
    headerBg: '#1a1a1a',
    accent: '#4da6ff',
    danger: '#f87171',
    success: '#4ade80',
    warning: '#fbbf24',
    inputBg: '#2a2a2a',
    inputBorder: '#5a5a5a',
    rowPressed: '#2a2a2a',
    trackFalse: '#555',
    modalOverlay: 'rgba(0,0,0,0.7)',
    badgeBg: '#1e3a5f',
    cardBorder: '#404040',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

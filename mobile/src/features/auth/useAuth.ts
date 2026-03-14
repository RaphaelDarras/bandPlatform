import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { apiPinLogin } from '@/api/auth';
import { setupPinLocally, verifyPinOffline, getCachedToken } from './pinAuth';
import { scheduleExpiryWarning, clearExpiryWarning } from './sessionExpiry';
import i18n from '@/i18n';

/**
 * Auth hook providing login, logout, and auth state.
 *
 * Login flow:
 * - Online: calls API, stores token + PIN hash locally, schedules session expiry warning
 * - Offline: verifies PIN against local hash, uses cached JWT
 */
export function useAuth() {
  const { isAuthenticated, user, setToken, clearAuth } = useAuthStore();
  const { isOnline } = useSyncStore();
  const [isLoading, setIsLoading] = useState(false);

  async function login(pin: string): Promise<void> {
    setIsLoading(true);
    try {
      if (isOnline) {
        // Online login path
        try {
          const { token, user: apiUser } = await apiPinLogin(pin);
          await setupPinLocally(pin, token);
          setToken(token, apiUser);
          clearExpiryWarning();
          scheduleExpiryWarning(token, () => {
            Alert.alert(
              i18n.t('auth.sessionExpiring'),
              i18n.t('auth.sessionExpiringMessage'),
              [{ text: i18n.t('common.ok') }]
            );
          });
          return;
        } catch (networkError: unknown) {
          // If it's a network error, fall through to offline path
          const err = networkError as { code?: string; message?: string };
          const isNetworkError =
            err.code === 'ECONNABORTED' ||
            err.code === 'ERR_NETWORK' ||
            err.message?.toLowerCase().includes('network');
          if (!isNetworkError) {
            throw networkError;
          }
          // Fall through to offline path
        }
      }

      // Offline login path (or online failed with network error)
      const isValid = await verifyPinOffline(pin);
      if (!isValid) {
        throw new Error(i18n.t('auth.loginFailed'));
      }
      const cachedToken = await getCachedToken();
      if (!cachedToken) {
        throw new Error(i18n.t('auth.needOnlineFirst'));
      }
      // Use cached token — user object isn't cached separately; use auth store's last known user
      const currentUser = useAuthStore.getState().user;
      setToken(cachedToken, currentUser ?? { id: '', username: '', role: '' });
      clearExpiryWarning();
      scheduleExpiryWarning(cachedToken, () => {
        Alert.alert(
          i18n.t('auth.sessionExpiring'),
          i18n.t('auth.sessionExpiringMessage'),
          [{ text: i18n.t('common.ok') }]
        );
      });
    } finally {
      setIsLoading(false);
    }
  }

  function logout(): void {
    // Do NOT clear SecureStore PIN hash — enables offline re-login
    clearAuth();
    clearExpiryWarning();
  }

  return {
    login,
    logout,
    isAuthenticated,
    user,
    isLoading,
  };
}

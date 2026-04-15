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
  const [isLoading, setIsLoading] = useState(false);

  async function login(pin: string): Promise<void> {
    setIsLoading(true);
    try {
      // Reset stale sync timestamp from previous session
      useSyncStore.getState().setLastSyncAt(Date.now());

      // Always try online first — isOnline flag only gates background sync,
      // not login. A stale isOnline=false from persisted state must not
      // prevent the user from logging in when the server is actually reachable.
      let serverUnreachable = false;
      {
        // Online login path — retry once on timeout (Render free tier cold start)
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const { token, user: apiUser } = await apiPinLogin(pin);
            await setupPinLocally(pin, token);
            setToken(token, apiUser);
            useSyncStore.getState().resetFailures();
            useSyncStore.getState().setIsOnline(true);
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
            const err = networkError as { code?: string; message?: string };
            const isNetworkError =
              err.code === 'ECONNABORTED' ||
              err.code === 'ERR_NETWORK' ||
              err.message?.toLowerCase().includes('network') ||
              err.message?.toLowerCase().includes('timeout');
            if (!isNetworkError) {
              throw networkError;
            }
            // On first attempt timeout, retry; on second, fall through to offline
            if (attempt === 1) serverUnreachable = true;
          }
        }
      }

      // Offline login path (or online failed with network error)
      const isValid = await verifyPinOffline(pin);
      if (!isValid) {
        if (serverUnreachable) {
          throw new Error(i18n.t('auth.serverUnreachable'));
        }
        throw new Error(i18n.t('auth.loginFailed'));
      }
      const cachedToken = await getCachedToken();
      if (!cachedToken) {
        if (serverUnreachable) {
          throw new Error(i18n.t('auth.serverUnreachable'));
        }
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

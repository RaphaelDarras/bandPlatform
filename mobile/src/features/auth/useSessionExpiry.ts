import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useAuthStore } from '@/stores/authStore';
import { parseJwtExp, shouldEndExpiredSession } from './sessionExpiry';

/**
 * Sends the user back to the PIN screen as soon as the JWT has expired —
 * on app start, on return to the foreground, and at the exact expiry moment
 * while the app is open — instead of waiting for an API call to hit 401.
 *
 * The redirect itself is done by the Stack.Protected guards in the root
 * layout reacting to clearAuth(). See shouldEndExpiredSession for why an
 * unreachable API keeps the session.
 */
export function useSessionExpiry(): void {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const check = async () => {
      // refresh() runs the reachability probe configured in the root layout
      // (GET <api>/health), so this reflects the API, not just Wi-Fi state.
      const state = await NetInfo.refresh().catch(() => null);
      if (cancelled) return;
      const current = useAuthStore.getState().token;
      if (current !== token) return; // re-logged in meanwhile
      if (shouldEndExpiredSession(current, state ? state.isInternetReachable : null)) {
        useAuthStore.getState().clearAuth();
      }
    };

    void check();

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });

    // Fire at the expiry moment while the app stays open. setTimeout's max is
    // ~24.8 days; JWTs here last 24h, so a single timer is enough.
    const exp = parseJwtExp(token);
    const delay = exp === null ? 0 : exp * 1000 - Date.now() + 1000;
    const timer = delay > 0 && delay < 2 ** 31 - 1 ? setTimeout(() => void check(), delay) : null;

    return () => {
      cancelled = true;
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [token]);
}

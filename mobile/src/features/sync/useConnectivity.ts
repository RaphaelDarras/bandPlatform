/**
 * useConnectivitySync — subscribes to NetInfo changes, updates syncStore,
 * and triggers requestSync when transitioning from offline to online.
 */
import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { AxiosInstance } from 'axios';

import { useSyncStore } from '@/stores/syncStore';
import { requestSync } from '@/features/sync/SyncManager';

export function useConnectivitySync(
  db: SQLiteDatabase | null,
  apiClient: AxiosInstance
): void {
  const wasOfflineRef = useRef<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can be null on Android initially — treat null as reachable
      const deviceOnline = !!(state.isConnected && state.isInternetReachable !== false);
      const { consecutiveFailures } = useSyncStore.getState();

      // Device has network BUT server is unreachable (3+ consecutive sync failures)
      const isOnline = deviceOnline && consecutiveFailures < 3;
      useSyncStore.getState().setIsOnline(isOnline);

      // Trigger sync when transitioning from offline to online
      if (wasOfflineRef.current === false && isOnline && db) {
        requestSync(db, apiClient);
      }

      wasOfflineRef.current = isOnline;
    });

    return () => {
      unsubscribe();
    };
  }, [db, apiClient]);
}

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

const mmkv = createMMKV({ id: 'sync-store' });
const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.remove(key),
};

interface SyncStore {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  consecutiveFailures: number;
  setIsOnline: (online: boolean) => void;
  setPendingCount: (count: number) => void;
  setLastSyncAt: (timestamp: number) => void;
  incrementFailures: () => void;
  resetFailures: () => void;
}

export const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      isOnline: false,
      pendingCount: 0,
      lastSyncAt: null,
      consecutiveFailures: 0,

      setIsOnline: (online) => set({ isOnline: online }),

      setPendingCount: (count) => set({ pendingCount: count }),

      setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),

      incrementFailures: () =>
        set((s) => ({ consecutiveFailures: s.consecutiveFailures + 1 })),

      resetFailures: () => set({ consecutiveFailures: 0 }),
    }),
    {
      name: 'sync',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);

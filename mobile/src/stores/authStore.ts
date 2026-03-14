import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

const mmkv = createMMKV({ id: 'auth-store' });
const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.remove(key),
};

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

interface AuthStore {
  token: string | null;
  isAuthenticated: boolean;
  user: AuthUser | null;
  setToken: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
  getToken: () => string | null;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      isAuthenticated: false,
      user: null,

      setToken: (token, user) => set({ token, isAuthenticated: true, user }),

      clearAuth: () => set({ token: null, isAuthenticated: false, user: null }),

      getToken: () => get().token,
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);

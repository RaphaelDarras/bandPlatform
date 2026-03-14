import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

/**
 * Axios instance with base URL and JWT interceptors.
 * Base URL is read from Expo Constants (app.json extra.apiUrl) or defaults to localhost.
 */
let apiUrl = 'http://localhost:3000/api';
try {
  // expo-constants may not be available in all environments (e.g., tests)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Constants = require('expo-constants').default;
  if (Constants?.expoConfig?.extra?.apiUrl) {
    apiUrl = Constants.expoConfig.extra.apiUrl;
  }
} catch {
  // Fall back to default in test/non-Expo environments
}

export const apiClient = axios.create({
  baseURL: apiUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: inject Bearer token from auth store
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: on 401, clear auth state
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  }
);

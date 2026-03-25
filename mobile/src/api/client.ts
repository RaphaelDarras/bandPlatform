import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

/**
 * Axios instance with base URL and JWT interceptors.
 * Base URL is read from EXPO_PUBLIC_API_URL env variable or defaults to localhost.
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:5000/api';

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

// Response interceptor: on 401/403, clear auth state so the user is sent back to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  }
);

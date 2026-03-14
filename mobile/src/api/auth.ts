import { apiClient } from './client';
import type { AuthUser } from '@/stores/authStore';

export interface PinLoginResponse {
  token: string;
  user: AuthUser;
}

export interface PinSetupResponse {
  message: string;
}

export interface VerifyTokenResponse {
  valid: boolean;
  user: AuthUser;
}

/**
 * POST /auth/pin-login — authenticate with PIN, receive JWT and user info.
 */
export async function apiPinLogin(pin: string): Promise<PinLoginResponse> {
  const { data } = await apiClient.post<PinLoginResponse>('/auth/pin-login', { pin });
  return data;
}

/**
 * POST /auth/pin-setup — set up PIN for the authenticated user.
 * Requires a valid JWT in the request (provided by the interceptor).
 */
export async function apiPinSetup(pin: string): Promise<PinSetupResponse> {
  const { data } = await apiClient.post<PinSetupResponse>('/auth/pin-setup', { pin });
  return data;
}

/**
 * POST /auth/verify — verify the current JWT is still valid.
 */
export async function apiVerifyToken(): Promise<VerifyTokenResponse> {
  const { data } = await apiClient.post<VerifyTokenResponse>('/auth/verify');
  return data;
}

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PIN_HASH_KEY = 'pin_hash';
const AUTH_TOKEN_KEY = 'auth_token';

/**
 * Hashes a PIN using SHA-256.
 * Returns a deterministic hex string.
 */
export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

/**
 * Stores the PIN hash and JWT in SecureStore after a successful online login.
 * This enables offline re-authentication.
 */
export async function setupPinLocally(pin: string, jwt: string): Promise<void> {
  const hash = await hashPin(pin);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, jwt);
}

/**
 * Verifies a PIN against the locally stored hash.
 * Returns false if no hash is stored (fresh install).
 */
export async function verifyPinOffline(pin: string): Promise<boolean> {
  const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!storedHash) return false;
  const inputHash = await hashPin(pin);
  return inputHash === storedHash;
}

/**
 * Returns the cached JWT from SecureStore, or null if not present.
 */
export async function getCachedToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

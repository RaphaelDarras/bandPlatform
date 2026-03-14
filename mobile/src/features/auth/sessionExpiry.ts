/**
 * JWT session expiry warning utilities.
 * Full implementation in Task 3.
 */

let activeTimerId: ReturnType<typeof setTimeout> | null = null;

/**
 * Extracts the `exp` claim from a JWT payload.
 * Returns Unix timestamp (seconds) or null if malformed.
 */
export function parseJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64url decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = atob(padded);
    const json = JSON.parse(decoded);
    if (typeof json.exp !== 'number') return null;
    return json.exp;
  } catch {
    return null;
  }
}

/**
 * Schedules a warning callback to fire 30 minutes before JWT expiry.
 * Returns a cleanup function that cancels the timer.
 * Fires immediately if token expires within 30 minutes or is already expired.
 */
export function scheduleExpiryWarning(
  token: string,
  onWarning: () => void
): () => void {
  const exp = parseJwtExp(token);
  if (exp === null) return () => {};

  const warningTime = exp * 1000 - 30 * 60 * 1000;
  const delay = warningTime - Date.now();

  if (delay <= 0) {
    onWarning();
    return () => {};
  }

  const timerId = setTimeout(() => {
    activeTimerId = null;
    onWarning();
  }, delay);
  activeTimerId = timerId;

  return () => {
    clearTimeout(timerId);
    if (activeTimerId === timerId) activeTimerId = null;
  };
}

/**
 * Cancels any active session expiry timer.
 */
export function clearExpiryWarning(): void {
  if (activeTimerId !== null) {
    clearTimeout(activeTimerId);
    activeTimerId = null;
  }
}

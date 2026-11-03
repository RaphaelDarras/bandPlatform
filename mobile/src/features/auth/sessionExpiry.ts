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

/** True when the token's exp has passed (or it is unreadable). */
export function isTokenExpired(token: string | null, now: number = Date.now()): boolean {
  if (!token) return false;
  const exp = parseJwtExp(token);
  return exp === null || exp * 1000 <= now;
}

/**
 * Whether an expired session should be ended now (user sent to the PIN screen).
 *
 * Only when the API is reachable: offline, the PIN screen can only re-issue the
 * same cached (expired) token, so logging out would just bounce the user back
 * to the PIN screen on every app resume at a venue with no signal — while the
 * POS (local SQLite + Shopify stock ops) still works fine on the old session.
 * Unknown reachability (null) counts as reachable: an unnecessary trip to the
 * PIN screen is recoverable offline, a dashboard that silently 401s is not.
 */
export function shouldEndExpiredSession(
  token: string | null,
  apiReachable: boolean | null,
  now: number = Date.now()
): boolean {
  return isTokenExpired(token, now) && apiReachable !== false;
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

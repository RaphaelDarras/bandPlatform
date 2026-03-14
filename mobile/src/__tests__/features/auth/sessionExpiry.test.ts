import { parseJwtExp, scheduleExpiryWarning, clearExpiryWarning } from '@/features/auth/sessionExpiry';

// Helper: build a minimal JWT with a known exp claim
function makeJwt(exp: number | undefined): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = btoa(JSON.stringify(exp !== undefined ? { exp, sub: 'test' } : { sub: 'test' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${payload}.fakesig`;
}

beforeEach(() => {
  jest.useFakeTimers();
  clearExpiryWarning();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('parseJwtExp', () => {
  it('extracts exp from a valid JWT', () => {
    const token = makeJwt(1710000000);
    expect(parseJwtExp(token)).toBe(1710000000);
  });

  it('returns null for a malformed token (not 3 parts)', () => {
    expect(parseJwtExp('not-a-jwt')).toBeNull();
  });

  it('returns null for a token without exp claim', () => {
    const token = makeJwt(undefined);
    expect(parseJwtExp(token)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseJwtExp('')).toBeNull();
  });

  it('returns null for a token with invalid base64 payload', () => {
    expect(parseJwtExp('header.!!!invalid!!!.sig')).toBeNull();
  });
});

describe('scheduleExpiryWarning', () => {
  it('schedules timer to fire at exp - 30 minutes', () => {
    const onWarning = jest.fn();
    // Token expires 60 minutes in the future
    const futureExp = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);
    const token = makeJwt(futureExp);

    scheduleExpiryWarning(token, onWarning);

    // Warning should NOT fire yet
    expect(onWarning).not.toHaveBeenCalled();

    // Advance by 30 minutes — warning should fire
    jest.advanceTimersByTime(30 * 60 * 1000);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it('fires immediately when token expires in < 30 minutes', () => {
    const onWarning = jest.fn();
    // Token expires in 10 minutes (< 30 min window)
    const nearExp = Math.floor((Date.now() + 10 * 60 * 1000) / 1000);
    const token = makeJwt(nearExp);

    scheduleExpiryWarning(token, onWarning);

    // Should fire immediately (delay <= 0)
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it('fires immediately when token is already expired', () => {
    const onWarning = jest.fn();
    // Token expired 1 hour ago
    const pastExp = Math.floor((Date.now() - 60 * 60 * 1000) / 1000);
    const token = makeJwt(pastExp);

    scheduleExpiryWarning(token, onWarning);

    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it('returns cleanup function that cancels the scheduled timer', () => {
    const onWarning = jest.fn();
    const futureExp = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);
    const token = makeJwt(futureExp);

    const cleanup = scheduleExpiryWarning(token, onWarning);
    cleanup();

    // Advance well past when it would have fired
    jest.advanceTimersByTime(60 * 60 * 1000);
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('returns no-op cleanup for malformed token', () => {
    const onWarning = jest.fn();
    const cleanup = scheduleExpiryWarning('not-a-jwt', onWarning);
    expect(typeof cleanup).toBe('function');
    expect(onWarning).not.toHaveBeenCalled();
    // Should not throw
    cleanup();
  });
});

describe('clearExpiryWarning', () => {
  it('cancels active timer', () => {
    const onWarning = jest.fn();
    const futureExp = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);
    const token = makeJwt(futureExp);

    scheduleExpiryWarning(token, onWarning);
    clearExpiryWarning();

    jest.advanceTimersByTime(60 * 60 * 1000);
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('is safe to call when no timer is active', () => {
    // Should not throw
    expect(() => clearExpiryWarning()).not.toThrow();
  });
});

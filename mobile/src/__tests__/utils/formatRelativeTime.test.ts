import { formatRelativeTime } from '@/utils/formatRelativeTime';

describe('formatRelativeTime', () => {
  it('returns "just now" for timestamps within the last minute', () => {
    expect(formatRelativeTime(Date.now())).toBe('just now');
    expect(formatRelativeTime(Date.now() - 30000)).toBe('just now');
    expect(formatRelativeTime(Date.now() - 59000)).toBe('just now');
  });

  it('returns "1min ago" for timestamps exactly 1 minute ago', () => {
    expect(formatRelativeTime(Date.now() - 60000)).toBe('1min ago');
  });

  it('returns "5min ago" for timestamps 5 minutes ago', () => {
    expect(formatRelativeTime(Date.now() - 300000)).toBe('5min ago');
  });

  it('returns "60min ago" for timestamps 1 hour ago', () => {
    expect(formatRelativeTime(Date.now() - 3600000)).toBe('60min ago');
  });
});

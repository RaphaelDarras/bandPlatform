/**
 * Formats a timestamp into a human-readable relative time string.
 * Used for displaying last sync time in the sync indicator.
 */
export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1min ago';
  return `${diffMins}min ago`;
}

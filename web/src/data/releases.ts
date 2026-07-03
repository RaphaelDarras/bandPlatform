// Hand-authored discography config (D-18/D-19/D-20/D-21).
// Array order = display order. No metadata fields (no title/date). Each entry
// is EITHER a Spotify embed OR a YouTube video — never both (D-17).
// Add a release = add one object here.

export type Release =
  | { kind: 'spotify'; embedType: 'track' | 'album' | 'playlist'; id: string }
  | { kind: 'youtube'; videoId: string }

export const releases: Release[] = [
  { kind: 'spotify', embedType: 'track', id: '0tyZM3OawPGQc0heX67clL' }, // Crowned (live)
]

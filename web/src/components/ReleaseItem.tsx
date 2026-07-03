import type { Release } from '../data/releases'
import SpotifyEmbed from './SpotifyEmbed'
import YouTubeEmbed from './YouTubeEmbed'

// Discriminated-union renderer (WEB-02). Renders exactly ONE embed per
// release — never both Spotify and YouTube (D-17). No title/date metadata
// is rendered (D-20); the embed itself is the entire card content.
export default function ReleaseItem({ release }: { release: Release }) {
  return (
    <div className="border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4">
      {release.kind === 'spotify' ? (
        <SpotifyEmbed embedType={release.embedType} id={release.id} />
      ) : (
        <YouTubeEmbed videoId={release.videoId} />
      )}
    </div>
  )
}

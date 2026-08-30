import type { Release } from '../data/releases'
import SpotifyEmbed from './SpotifyEmbed'
import YouTubeEmbed from './YouTubeEmbed'

// Discriminated-union renderer (WEB-02). Renders exactly ONE embed per
// release — never both Spotify and YouTube (D-17). No title/date metadata
// is rendered (D-20); the embed itself is the entire card content.
//
// The embed sits in a clipped, hairlined frame so third-party iframes inherit
// the site's radius instead of floating as bare rectangles.
export default function ReleaseItem({ release }: { release: Release }) {
  return (
    <div className="overflow-hidden border border-[var(--color-hairline)] bg-[#141414] [&_iframe]:block">
      {release.kind === 'spotify' ? (
        <SpotifyEmbed embedType={release.embedType} id={release.id} />
      ) : (
        <YouTubeEmbed videoId={release.videoId} />
      )}
    </div>
  )
}

// Apple Music iframe embed. Uses embed.music.apple.com — the player renders
// without setting cookies until the visitor presses play. Lazy-loaded.
// theme=dark keeps it coherent with the dark site (like Spotify/Deezer).
export type AppleMusicEmbedType = 'artist' | 'album' | 'song' | 'playlist'

export default function AppleMusicEmbed({
  embedType,
  storefront,
  slug,
  id,
}: {
  embedType: AppleMusicEmbedType
  storefront: string
  slug: string
  id: string
}) {
  return (
    <iframe
      src={`https://embed.music.apple.com/${storefront}/${embedType}/${slug}/${id}?theme=dark`}
      width="100%"
      height={450}
      frameBorder={0}
      allow="autoplay *; encrypted-media *;"
      loading="lazy"
      title={`Apple Music ${embedType} player`}
    />
  )
}

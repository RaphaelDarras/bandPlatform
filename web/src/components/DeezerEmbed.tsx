// Deezer widget iframe embed. Uses the dark theme to match the site. The
// player streams previews without setting cookies until interaction.
export type DeezerEmbedType = 'artist' | 'album' | 'playlist' | 'track'

export default function DeezerEmbed({
  embedType,
  id,
  path = 'top_tracks',
}: {
  embedType: DeezerEmbedType
  id: string
  path?: string
}) {
  return (
    <iframe
      src={`https://widget.deezer.com/widget/dark/${embedType}/${id}/${path}`}
      width="100%"
      height={300}
      frameBorder={0}
      allow="encrypted-media; clipboard-write"
      loading="lazy"
      title="Deezer player"
    />
  )
}

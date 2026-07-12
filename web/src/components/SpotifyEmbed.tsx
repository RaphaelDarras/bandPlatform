// Spotify iframe embed (WEB-02). Ported from the production embed in
// website/crowned/index.html lines 193-201. Always lazy-loaded (Pitfall 6).
export type SpotifyEmbedType = 'track' | 'album' | 'playlist' | 'artist'

const HEIGHT_BY_TYPE: Record<SpotifyEmbedType, number> = {
  track: 152,
  album: 352,
  playlist: 352,
  artist: 352,
}

export default function SpotifyEmbed({
  embedType,
  id,
}: {
  embedType: SpotifyEmbedType
  id: string
}) {
  return (
    <iframe
      src={`https://open.spotify.com/embed/${embedType}/${id}?utm_source=generator`}
      width="100%"
      height={HEIGHT_BY_TYPE[embedType]}
      frameBorder={0}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      title={`Spotify ${embedType} player`}
    />
  )
}

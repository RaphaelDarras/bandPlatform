import { releases } from '../data/releases'
import ReleaseItem from '../components/ReleaseItem'
import SpotifyEmbed from '../components/SpotifyEmbed'
import AppleMusicEmbed from '../components/AppleMusicEmbed'
import DeezerEmbed from '../components/DeezerEmbed'

// Discography route (WEB-02). Maps the hand-authored releases[] config into
// one embed per entry, in array order (D-21), with no metadata (D-20).
export function Component() {
  return (
    <>
      <section>
        <h1 className="font-display text-3xl uppercase text-white">Latest Release</h1>
        <div className="mt-4 flex flex-col gap-6">
          {releases.map((r, i) => (
            <ReleaseItem key={i} release={r} />
          ))}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="font-display text-3xl uppercase text-white">Listen</h2>
        <div className="mt-4 flex flex-col gap-6">
          <SpotifyEmbed embedType="artist" id="5w35Gt5153qhoSwR4MVtEU" />
          <AppleMusicEmbed
            embedType="artist"
            storefront="us"
            slug="hurakan"
            id="1071054495"
          />
          <DeezerEmbed embedType="artist" id="10082442" path="top_tracks" />
        </div>
      </section>
    </>
  )
}

export default Component

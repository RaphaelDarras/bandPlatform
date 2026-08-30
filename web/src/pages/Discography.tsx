import { releases } from '../data/releases'
import ReleaseItem from '../components/ReleaseItem'
import SpotifyEmbed from '../components/SpotifyEmbed'
import AppleMusicEmbed from '../components/AppleMusicEmbed'
import DeezerEmbed from '../components/DeezerEmbed'
import Section, { PAGE_STACK } from '../components/Section'
import Reveal from '../components/Reveal'

// Discography route (WEB-02). Maps the hand-authored releases[] config into
// one embed per entry, in array order (D-21), with no metadata (D-20).
// Newest release is releases[0] — the same entry the home page highlights.
export function Component() {
  return (
    <div className={PAGE_STACK}>
      <Section title="Releases" eyebrow="Discography" as="h1">
        <div className="flex flex-col gap-6">
          {releases.map((r, i) => (
            <Reveal key={i} delay={i * 80}>
              <ReleaseItem release={r} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Reveal>
        <Section title="Listen" eyebrow="Everywhere else">
          <div className="flex flex-col gap-6">
            <SpotifyEmbed embedType="artist" id="5w35Gt5153qhoSwR4MVtEU" />
            <AppleMusicEmbed
              embedType="artist"
              storefront="us"
              slug="hurakan"
              id="1071054495"
            />
            <DeezerEmbed embedType="artist" id="10082442" path="top_tracks" />
          </div>
        </Section>
      </Reveal>
    </div>
  )
}

export default Component

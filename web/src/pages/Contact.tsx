import Section, { PageTitle, PAGE_STACK } from '../components/Section'
import Reveal from '../components/Reveal'

// Contact (WEB-04, D-13/D-14/D-16): static contact info only, no form, no
// backend. One email channel plus the band's external channels — Instagram,
// TikTok, Spotify, and the Shopify storefront (deliberately mirrors the
// footer icons; kept as a page so the channels exist as readable text).

const CHANNELS = [
  { label: 'Instagram', href: 'https://www.instagram.com/hurakanband/' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@hurakanband' },
  { label: 'Spotify', href: 'https://open.spotify.com/artist/5w35Gt5153qhoSwR4MVtEU' },
  { label: 'Shop', href: 'https://shop.hurakanband.fr/' },
]

// Channel rows: full-width tap targets with a steel arrow that slides on
// hover, rather than a bullet list of underlined text.
const rowClass =
  'group flex items-center justify-between rounded-xl border border-[var(--color-hairline)] ' +
  'px-4 py-3.5 transition-colors duration-200 hover:border-[var(--color-steel)] ' +
  'hover:bg-[rgba(94,127,133,0.12)]'

export function Component() {
  return (
    <div className={PAGE_STACK}>
      <PageTitle>Contact</PageTitle>

      <Reveal>
        <Section title="Email" eyebrow="Booking & press" surface>
          <a
            href="mailto:hurakanband@gmail.com"
            rel="noopener"
            className="type-h2 text-[var(--color-accent)] underline decoration-1 underline-offset-[6px] transition-colors hover:text-[var(--color-ink)]"
          >
            hurakanband@gmail.com
          </a>
        </Section>
      </Reveal>

      <Reveal>
        <Section title="Follow" eyebrow="Elsewhere" surface>
          <ul className="flex flex-col gap-2">
            {CHANNELS.map((c) => (
              <li key={c.label}>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={rowClass}
                >
                  <span className="type-label text-[var(--color-ink)]">{c.label}</span>
                  <span
                    aria-hidden="true"
                    className="text-[var(--color-steel)] transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                  >
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </Reveal>
    </div>
  )
}

export default Component

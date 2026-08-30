import Section, { PageTitle, PAGE_STACK } from '../components/Section'

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

export function Component() {
  return (
    <div className={PAGE_STACK}>
      <PageTitle>Contact</PageTitle>

      <Section title="Email" surface>
        <p className="font-sans text-white/75">
          <a href="mailto:hurakanband@gmail.com" rel="noopener" className="underline">
            hurakanband@gmail.com
          </a>
        </p>
      </Section>

      <Section title="Follow" surface>
        <ul className="flex flex-col gap-2 font-sans text-white/75">
          {CHANNELS.map((c) => (
            <li key={c.label}>
              <a
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {c.label}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

export default Component

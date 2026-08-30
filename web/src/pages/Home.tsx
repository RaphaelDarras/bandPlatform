import { useLoaderData } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import { clean, nextEvent, venueDisplay } from '../lib/bandsintown'
import { releases } from '../data/releases'
import ReleaseItem from '../components/ReleaseItem'
import Section, { PAGE_STACK } from '../components/Section'
import Button from '../components/Button'

// Landing hub (D-25). Section order runs free -> paid, and within "paid",
// time-sensitive before evergreen:
//   1. hero          — who we are + current release artwork
//   2. latest release— the hook, costs the visitor nothing
//   3. preorder      — the commercial ask, and it expires when the window
//                      closes, so it outranks both items below
//   4. next show     — dated, so it also expires
//   5. shop merch    — evergreen, lowest urgency
//
// Exactly one primary (filled) CTA per commercial intent: "Listen Now" for
// the music, "Preorder Now" for the album. Everything else is secondary or
// quiet, so the page never presents two equal-weight asks at once.
//
// All Bandsintown text renders as escaped React text (T-04-xss).

const STORE_URL = 'https://shop.hurakanband.fr/'

export function Component() {
  const { events } = (useLoaderData() as { events?: BitEvent[] }) ?? {}
  const next = nextEvent(events ?? [])
  const highlightedRelease = releases[0]

  return (
    <div className={PAGE_STACK}>
      <section className="text-center">
        <picture>
          {/* Wide Bandcamp-format banner on tablet/desktop; the less-extreme FB
              format on phones so the hero isn't a thin sliver (< 640px). Both
              carry the current release artwork ("Dogma"). */}
          <source
            media="(min-width: 640px)"
            srcSet="/images/BANDCAMP_DOGMA.avif"
            type="image/avif"
          />
          <img
            src="/images/FB_DOGMA.jpg"
            alt="Hurakan — new single Dogma, out now on all platforms"
            className="w-full"
          />
        </picture>
        {/* The page's single h1 (text-4xl). Section headings are text-2xl, so
            there is now a clear top to the document. */}
        <h1 className="mt-8 font-display text-4xl uppercase text-white">Hurakan</h1>
        <p className="mt-2 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white/75">
          French metal band
        </p>
      </section>

      {highlightedRelease && (
        <Section title="Latest Release" surface>
          <ReleaseItem release={highlightedRelease} />
          {/* The hero's former "Listen Now" button lives here now, next to the
              thing it refers to. Nav keeps its own Listen entry. */}
          <div className="mt-6">
            <Button to="/listen">Listen Now</Button>
          </div>
        </Section>
      )}

      {/* Preorder points at the store root for now, same as the merch block
          below. Because both resolve to the same URL, the preorder keeps the
          page's only primary commerce CTA and merch drops to a quiet link —
          two gold buttons to one destination would just compete. Swap this
          href for a deep link once the album has its own product page. */}
      <Section title="Preorder The Album" surface>
        <p className="font-sans text-base text-white/75">
          The new album is up for preorder — secure your copy from the official shop.
        </p>
        <div className="mt-6">
          <Button href={STORE_URL}>Preorder Now</Button>
        </div>
      </Section>

      <Section title="Next Show" surface>
        {next ? (
          <>
            <p className="font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white/75">
              {new Date(next.datetime).toLocaleDateString('en')} — {venueDisplay(next)} —{' '}
              {next.venue.city}, {next.venue.country}
            </p>
            {next.offers.length > 0 && (
              <div className="mt-6">
                <Button variant="secondary" href={clean(next.offers[0].url)}>
                  Get Tickets
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="font-sans text-sm text-white/75">No shows scheduled.</p>
        )}
        <div className="mt-6">
          <Button variant="quiet" to="/concerts">
            All concerts
          </Button>
        </div>
      </Section>

      <Section title="Shop Merch" surface>
        <p className="font-sans text-base text-white/75">
          Grab official Hurakan merch — apparel and more from the online shop.
        </p>
        {/* Thumbnail and link both point at the store root (they used to
            disagree — the image deep-linked to a single product). 416px
            derivative sized for the 208px slot. */}
        <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="mt-6 block">
          <img
            src="/images/Artwork_Final_thumb.jpg"
            alt="Hurakan merch artwork"
            width={416}
            height={416}
            className="w-52"
          />
        </a>
        <div className="mt-6">
          <Button variant="quiet" href={STORE_URL}>
            Shop Now
          </Button>
        </div>
      </Section>
    </div>
  )
}

export default Component

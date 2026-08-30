import { useLoaderData } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import { clean, nextEvent, venueDisplay } from '../lib/bandsintown'
import { releases } from '../data/releases'
import type { Catalogue } from '../lib/shopify'
import { STORE_URL } from '../lib/shopify'
import FullscreenPlayer from '../components/FullscreenPlayer'
import ProductGrid from '../components/ProductGrid'
import Section, { PAGE_STACK } from '../components/Section'
import Button from '../components/Button'
import Reveal from '../components/Reveal'

// Landing hub (D-25). Order:
//   1. full-screen player — the latest release, taking the whole viewport
//   2. preorder           — the album, expires when the window closes
//   3. all merch          — the full catalogue
//   4. next show          — dated
//
// Every product card deep-links to its own Shopify detail page; the only
// store-root links left are the two "everything" buttons.
//
// All Bandsintown text renders as escaped React text (T-04-xss).

export function Component() {
  const { events, catalogue } =
    (useLoaderData() as { events?: BitEvent[]; catalogue?: Catalogue }) ?? {}
  const next = nextEvent(events ?? [])
  const highlightedRelease = releases[0]
  const preorder = catalogue?.preorder ?? []
  const all = catalogue?.all ?? []

  return (
    <div className={PAGE_STACK}>
      {/* Full-viewport hero player. The release[0] entry is a YouTube video
          (D-17), so the hero is the latest release rather than a banner with
          the player buried in a section below it. */}
      {highlightedRelease?.kind === 'youtube' && (
        <FullscreenPlayer
          videoId={highlightedRelease.videoId}
          poster="/images/FB_DOGMA.jpg"
          posterWide="/images/BANDCAMP_DOGMA.avif"
          title="Dogma"
          eyebrow="New single — out now"
          action={
            <Button variant="secondary" to="/listen">
              Listen Now
            </Button>
          }
        />
      )}

      {preorder.length > 0 && (
        <Reveal>
          <Section title="Preorder" eyebrow="Eternal Scars — 30 October">
            <p className="type-body mb-7 text-[var(--color-ink-dim)]">
              Out October 30th, shipping from November 1st.
            </p>
            <ProductGrid products={preorder} />
          </Section>
        </Reveal>
      )}

      {all.length > 0 ? (
        <Reveal>
          <Section title="All" eyebrow="Merch">
            <ProductGrid products={all} />
            <div className="mt-8">
              <Button href={STORE_URL}>Open the shop</Button>
            </div>
          </Section>
        </Reveal>
      ) : (
        // Catalogue fetch failed soft, or we are in dev: keep a way to the shop.
        <Reveal>
          <Section title="Merch" eyebrow="Shop">
            <p className="type-body mb-7 text-[var(--color-ink-dim)]">
              Apparel, vinyl and more from the official shop.
            </p>
            <Button href={STORE_URL}>Open the shop</Button>
          </Section>
        </Reveal>
      )}

      <Reveal>
        <Section title="Next Show" eyebrow="On tour">
          {next ? (
            <>
              <p className="type-label tabular-nums text-[var(--color-steel)]">
                {new Date(next.datetime).toLocaleDateString('en', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              <p className="type-h2 mt-2 text-[var(--color-ink)]">{venueDisplay(next)}</p>
              <p className="mt-1 font-sans text-sm text-[var(--color-ink-dim)]">
                {next.venue.city}, {next.venue.country}
              </p>
              {next.offers.length > 0 && (
                <div className="mt-7">
                  <Button variant="secondary" href={clean(next.offers[0].url)}>
                    Get Tickets
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="type-body text-[var(--color-ink-dim)]">No shows scheduled.</p>
          )}
          <div className="mt-7">
            <Button variant="quiet" to="/concerts">
              All concerts
            </Button>
          </div>
        </Section>
      </Reveal>
    </div>
  )
}

export default Component

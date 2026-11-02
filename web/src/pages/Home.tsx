import { useLoaderData } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import { clean, nextEvent, venueDisplay } from '../lib/bandsintown'
import { useUpcomingEvents } from '../hooks/useUpcomingEvents'
import { releases } from '../data/releases'
import type { Catalogue } from '../lib/shopify'
import { STORE_URL } from '../lib/shopify'
import FullscreenPlayer from '../components/FullscreenPlayer'
import ProductGrid from '../components/ProductGrid'
import Section, { PAGE_STACK } from '../components/Section'
import Button from '../components/Button'
import Reveal from '../components/Reveal'

// Landing hub (D-25). Order:
//   1. player   — the latest release, full-bleed, shown directly
//   2. merch    — the whole store, album products first
//   3. next show— dated
//
// The catalogue's preorder/merch slices partition the store, so concatenating
// them lists every product exactly once. Every card deep-links to its own Shopify detail page; the store root appears
// once, on "Open the shop".
//
// All Bandsintown text renders as escaped React text (T-04-xss).

export function Component() {
  const { events, catalogue } =
    (useLoaderData() as { events?: BitEvent[]; catalogue?: Catalogue }) ?? {}
  // Baked at build time, so a show can be over by the time someone reads this:
  // re-filter against the visitor's clock before picking the teaser.
  const next = nextEvent(useUpcomingEvents(events ?? []))
  const highlightedRelease = releases[0]
  // Preorders are over: the album products (still the "preorder" slice, i.e.
  // outside the all-no-preorder collection) lead the single Merch grid.
  const merch = [...(catalogue?.preorder ?? []), ...(catalogue?.merch ?? [])]

  return (
    <div className={PAGE_STACK}>
      {/* The release[0] entry is a YouTube video (D-17), so the hero is the
          release itself — player shown directly, no poster or play overlay. */}
      {highlightedRelease?.kind === 'youtube' && (
        // Wrapped so the announcement sits tight on the player instead of
        // taking a full PAGE_STACK gap. The player keeps the page's only h1,
        // so the visible title here is a plain paragraph.
        <div>
          <div className="mb-6 sm:mb-8">
            <p className="type-label text-[var(--color-accent)]">New album · Out now</p>
            <p className="type-h1 mt-3 text-[var(--color-ink)]">Eternal Scars</p>
          </div>
          <FullscreenPlayer videoId={highlightedRelease.videoId} title="Eternal Scars" />
        </div>
      )}

      {merch.length > 0 ? (
        <Reveal>
          <Section title="Merch">
            <ProductGrid products={merch} />
            <div className="mt-8">
              <Button href={STORE_URL}>Open the shop</Button>
            </div>
          </Section>
        </Reveal>
      ) : (
        // Catalogue fetch failed soft, or we are in dev: keep a way to the shop.
        <Reveal>
          <Section title="Merch">
            <p className="type-body mb-7 text-[var(--color-ink-dim)]">
              Apparel, vinyl and more from the official shop.
            </p>
            <Button href={STORE_URL}>Open the shop</Button>
          </Section>
        </Reveal>
      )}

      <Reveal>
        <Section title="Next Show">
          {next ? (
            <>
              <p className="type-label tabular-nums text-[var(--color-ink-dim)]">
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

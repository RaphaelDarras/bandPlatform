import { useLoaderData } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import { clean, nextEvent, venueDisplay } from '../lib/bandsintown'
import { releases } from '../data/releases'
import type { PreorderProduct } from '../lib/shopify'
import { STORE_URL } from '../lib/shopify'
import ReleaseItem from '../components/ReleaseItem'
import PreorderGrid from '../components/PreorderGrid'
import Section, { PAGE_STACK } from '../components/Section'
import Button from '../components/Button'
import Reveal from '../components/Reveal'

// Landing hub (D-25). Section order runs free -> paid:
//   1. hero          — current release artwork, full-bleed
//   2. latest release— the hook, costs the visitor nothing
//   3. preorder      — the commercial ask, and it expires when the window
//                      closes, so it outranks the dated section below
//   4. next show     — dated, so it also expires
//
// There is deliberately no general merch teaser: it pointed at the same store
// root as the preorder, so it added a second ask with nothing new behind it.
// Merch stays reachable from the nav, the footer icon and /contact.
//
// All Bandsintown text renders as escaped React text (T-04-xss).

export function Component() {
  const { events, preorder } =
    (useLoaderData() as { events?: BitEvent[]; preorder?: PreorderProduct[] }) ?? {}
  const next = nextEvent(events ?? [])
  const highlightedRelease = releases[0]
  const preorderProducts = preorder ?? []

  return (
    <div className={PAGE_STACK}>
      {/* Hero breaks the main container's padding to go edge-to-edge, and the
          banner's bottom is masked into the page background so it stops
          reading as a rectangle pasted at the top of a document. */}
      <section className="-mx-5 -mt-10 sm:-mt-14">
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
            className="hero-fade w-full"
          />
        </picture>
        {/* Kept as a real h1 for SEO and screen readers — the banner carries
            the wordmark visually, so showing it twice was redundant. */}
        <h1 className="sr-only">Hurakan</h1>
      </section>

      {highlightedRelease && (
        <Reveal>
          <Section title="Latest Release" eyebrow="Out now" surface>
            <ReleaseItem release={highlightedRelease} />
            <div className="mt-7">
              <Button to="/listen">Listen Now</Button>
            </div>
          </Section>
        </Reveal>
      )}

      {/* Featured formats come live from Shopify at build time (thumbnail,
          price, availability), so each card deep-links to its own product page
          instead of dumping the visitor on the store root. If that fetch fails
          soft — or in dev, where it always returns [] — the section degrades to
          the single storefront button it used to be. */}
      <Reveal>
        <Section title="Preorder The Album" eyebrow="Eternal Scars — 30 October" surface>
          <p className="type-body text-[var(--color-ink-dim)]">
            <span className="text-[var(--color-ink)]">Eternal Scars</span> is up for preorder —
            out October 30th, shipping from November 1st.
          </p>
          {preorderProducts.length > 0 ? (
            <>
              <div className="mt-7">
                <PreorderGrid products={preorderProducts} />
              </div>
              <div className="mt-7">
                <Button href={STORE_URL}>All preorder items</Button>
              </div>
            </>
          ) : (
            <div className="mt-7">
              <Button href={STORE_URL}>Preorder Now</Button>
            </div>
          )}
        </Section>
      </Reveal>

      <Reveal>
        <Section title="Next Show" eyebrow="On tour" surface>
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

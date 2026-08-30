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

// Landing hub (D-25). Section order runs free -> paid:
//   1. hero          — who we are + current release artwork
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
        {/* Kept as a real h1 for SEO and screen readers — the banner carries
            the wordmark visually, so showing it twice was redundant. */}
        <h1 className="sr-only">Hurakan</h1>
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

      {/* Featured formats come live from Shopify at build time (thumbnail,
          price, availability), so each card deep-links to its own product page
          instead of dumping the visitor on the store root. If that fetch fails
          soft — or in dev, where it always returns [] — the section degrades to
          the single storefront button it used to be. */}
      <Section title="Preorder The Album" surface>
        <p className="font-sans text-base text-white/75">
          <em className="not-italic text-white">Eternal Scars</em> is up for preorder — out
          October 30th, shipping from November 1st.
        </p>
        {preorderProducts.length > 0 ? (
          <>
            <div className="mt-6">
              <PreorderGrid products={preorderProducts} />
            </div>
            <div className="mt-6">
              <Button variant="quiet" href={STORE_URL}>
                All preorder items
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-6">
            <Button href={STORE_URL}>Preorder Now</Button>
          </div>
        )}
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
    </div>
  )
}

export default Component

import { Link, useLoaderData } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import { clean, nextEvent, venueDisplay } from '../lib/bandsintown'
import { releases } from '../data/releases'
import ReleaseItem from '../components/ReleaseItem'

// Landing hub (D-25): hero wordmark + next-concert teaser + release teaser +
// merch teaser (Phase 5, D-20 — extends D-25's original "no merch teaser"
// scope; the teaser now links out to the Shopify storefront). All Bandsintown
// text renders as escaped React text (T-04-xss).
export function Component() {
  const { events } = (useLoaderData() as { events?: BitEvent[] }) ?? {}
  const next = nextEvent(events ?? [])
  const highlightedRelease = releases[0]

  return (
    <div className="flex flex-col gap-12">
      <section className="text-center">
        <picture>
          {/* Wide Bandcamp banner on tablet/desktop; the less-extreme FB banner
              on phones so the hero isn't a thin sliver (< 640px). */}
          <source media="(min-width: 640px)" srcSet="/images/BANDCAMP.jpg" />
          <img src="/images/FB.jpg" alt="Hurakan" className="w-full" />
        </picture>
        <Link
          to="/listen"
          className="mt-6 inline-block bg-[var(--color-accent)] px-6 py-3 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-black"
        >
          Listen Now
        </Link>
      </section>

      <section>
        <h2 className="font-display text-3xl uppercase text-white">Shop Merch</h2>
        <p className="mt-2 font-sans text-base text-white/75">
          Grab official Hurakan merch — apparel and more from the online shop.
        </p>
        <a
          href="https://shop.hurakanband.fr/products/digital-product"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block"
        >
          <img src="/images/Artwork_Final.jpg" alt="Final artwork" className="w-52" />
        </a>
        <a
          href="https://shop.hurakanband.fr/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block bg-[var(--color-accent)] px-6 py-3 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-black"
        >
          Shop Now
        </a>
      </section>

      {highlightedRelease && (
        <section>
          <h2 className="font-display text-3xl uppercase text-white">Latest Release</h2>
          <div className="mt-4">
            <ReleaseItem release={highlightedRelease} />
          </div>
          <Link
            to="/listen"
            className="mt-2 inline-block text-sm font-semibold uppercase tracking-[0.06em] text-white underline"
          >
            Listen
          </Link>
        </section>
      )}

      <section>
        <h2 className="font-display text-3xl uppercase text-white">Next Show</h2>
        {next ? (
          <>
            <p className="mt-2 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white/75">
              {new Date(next.datetime).toLocaleDateString('en')} — {venueDisplay(next)} —{' '}
              {next.venue.city}, {next.venue.country}
            </p>
            {next.offers.length > 0 && (
              <a
                href={clean(next.offers[0].url)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block border border-[var(--color-accent)] px-4 py-2 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white hover:bg-[var(--color-accent)] hover:text-black"
              >
                Get Tickets
              </a>
            )}
          </>
        ) : (
          <p className="mt-2 font-sans text-sm text-white/75">No shows scheduled.</p>
        )}
        <Link to="/concerts" className="mt-2 block text-sm text-white/75 underline">
          All concerts
        </Link>
      </section>
    </div>
  )
}

export default Component

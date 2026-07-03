import { Link, useLoaderData } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'

// Landing hub (D-25): hero wordmark + next-concert teaser + release teaser.
// Full content/styling lands in Wave 1 — this is a buildable stub.
export function Component() {
  const { events } = (useLoaderData() as { events?: BitEvent[] }) ?? {}
  const next = events?.[0]

  return (
    <div className="flex flex-col gap-12">
      <section className="py-16 text-center">
        <h1 className="font-display text-6xl uppercase tracking-wide text-[var(--color-accent)] sm:text-7xl">
          Hurakan
        </h1>
        <Link
          to="/discography"
          className="mt-6 inline-block bg-[var(--color-accent)] px-6 py-3 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-black"
        >
          Listen Now
        </Link>
      </section>

      <section>
        <h2 className="font-display text-3xl uppercase text-white">Next Show</h2>
        {next ? (
          <p className="mt-2 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white/75">
            {next.venue.location} — {new Date(next.datetime).toLocaleDateString('en')}
          </p>
        ) : (
          <p className="mt-2 font-sans text-sm text-white/75">No shows scheduled.</p>
        )}
        <Link to="/concerts" className="mt-2 inline-block text-sm text-white/75 underline">
          All concerts
        </Link>
      </section>
    </div>
  )
}

export default Component

import { useLoaderData } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'

// Concerts route (WEB-03). Consumes build-time loader data; renders the
// empty-state copy (D-12) when there are no upcoming events. Full card layout
// / "Get Tickets" CTA land in Wave 1 — this is a buildable stub.
export function Component() {
  const { events } = (useLoaderData() as { events?: BitEvent[] }) ?? {}

  if (!events || events.length === 0) {
    return (
      <section>
        <h1 className="font-display text-3xl uppercase text-white">No shows scheduled</h1>
        <p className="mt-2 font-sans text-white/75">
          Follow us on Bandsintown to hear about new dates first.
        </p>
        <a
          href="https://www.bandsintown.com/a/433176?trigger=track"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block bg-[var(--color-accent)] px-6 py-3 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-black"
        >
          Follow on Bandsintown
        </a>
      </section>
    )
  }

  return (
    <section>
      <h1 className="font-display text-3xl uppercase text-white">Upcoming Shows</h1>
      <ul className="mt-4 flex flex-col gap-3">
        {events.map((e) => (
          <li
            key={e.id}
            className="border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4"
          >
            <time
              dateTime={e.datetime}
              className="font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white"
            >
              {new Date(e.datetime).toLocaleDateString('en')}
            </time>
            <p className="font-sans text-sm text-white/75">
              {e.venue.location}
              {e.title ? ` — ${e.title}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default Component

import { clean, venueDisplay, type BitEvent } from '../lib/bandsintown'

// Concert rows + empty state (WEB-03, D-12). All Bandsintown fields render as
// plain React text nodes — never dangerouslySetInnerHTML (T-04-xss).
export default function ConcertList({ events }: { events: BitEvent[] }) {
  if (events.length === 0) {
    return (
      <section>
        <h2 className="font-display text-3xl uppercase text-white">No shows scheduled</h2>
        <p className="mt-2 font-sans text-base text-white/75">
          Follow us on Bandsintown to hear about new dates first.
        </p>
        <a
          href="https://www.bandsintown.com/a/433176"
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
          <p className="mt-1 font-sans text-sm text-white/75">
            {venueDisplay(e)} — {e.venue.city}, {e.venue.country}
          </p>
          {e.offers.length > 0 && (
            <a
              href={clean(e.offers[0].url)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block border border-[var(--color-accent)] px-4 py-2 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white hover:bg-[var(--color-accent)] hover:text-black"
            >
              Get Tickets
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

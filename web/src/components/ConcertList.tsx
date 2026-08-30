import { clean, venueDisplay, type BitEvent } from '../lib/bandsintown'
import Section from './Section'
import Button from './Button'

// Concert rows + empty state (WEB-03, D-12). All Bandsintown fields render as
// plain React text nodes — never dangerouslySetInnerHTML (T-04-xss).
// Rows are already the site's panel treatment (hairline + recessed surface),
// which <Section surface> now matches.
export default function ConcertList({ events }: { events: BitEvent[] }) {
  if (events.length === 0) {
    return (
      <Section title="No shows scheduled">
        <p className="font-sans text-base text-white/75">
          Follow us on Bandsintown to hear about new dates first.
        </p>
        <div className="mt-6">
          <Button href="https://www.bandsintown.com/a/433176">Follow on Bandsintown</Button>
        </div>
      </Section>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
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
            <div className="mt-4">
              <Button variant="secondary" href={clean(e.offers[0].url)}>
                Get Tickets
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

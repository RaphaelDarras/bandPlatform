import { clean, venueDisplay, type BitEvent } from '../lib/bandsintown'
import Section from './Section'
import Button from './Button'

// Concert rows + empty state (WEB-03, D-12). All Bandsintown fields render as
// plain React text nodes — never dangerouslySetInnerHTML (T-04-xss).
//
// Rows are a two-column layout on anything wider than a phone: the date block
// in steel on the left, venue and CTA on the right. Dates use tabular-nums so
// the column stays aligned down the list.
export default function ConcertList({ events }: { events: BitEvent[] }) {
  if (events.length === 0) {
    return (
      <Section title="No shows scheduled">
        <p className="type-body text-[var(--color-ink-dim)]">
          Follow us on Bandsintown to hear about new dates first.
        </p>
        <div className="mt-7">
          <Button href="https://www.bandsintown.com/a/433176">Follow on Bandsintown</Button>
        </div>
      </Section>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((e) => {
        const date = new Date(e.datetime)
        return (
          <li
            key={e.id}
            className="card-hover panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-baseline gap-4 sm:gap-6">
              <time
                dateTime={e.datetime}
                className="type-label shrink-0 tabular-nums text-[var(--color-steel)]"
              >
                {date.toLocaleDateString('en', { day: '2-digit', month: 'short' })}
                <span className="ml-2 opacity-70">{date.getFullYear()}</span>
              </time>
              <div>
                <p className="type-h2 text-[var(--color-ink)]">{venueDisplay(e)}</p>
                <p className="mt-1 font-sans text-sm text-[var(--color-ink-dim)]">
                  {e.venue.city}, {e.venue.country}
                </p>
              </div>
            </div>
            {e.offers.length > 0 && (
              <Button variant="secondary" href={clean(e.offers[0].url)}>
                Get Tickets
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

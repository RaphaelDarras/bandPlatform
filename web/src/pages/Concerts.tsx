import { useLoaderData } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import { useUpcomingEvents } from '../hooks/useUpcomingEvents'
import ConcertList from '../components/ConcertList'
import Section from '../components/Section'

// Concerts route (WEB-03). Consumes build-time loader data; delegates rows
// and the D-12 empty state to ConcertList. Spacing and heading size come
// from <Section>.
//
// Loader data is only as fresh as the last build, so past dates are filtered
// against the visitor's clock before rendering.
export function Component() {
  const { events } = (useLoaderData() as { events?: BitEvent[] }) ?? {}
  const upcoming = useUpcomingEvents(events ?? [])

  return (
    <Section title="Upcoming Shows" as="h1">
      <ConcertList events={upcoming} />
    </Section>
  )
}

export default Component

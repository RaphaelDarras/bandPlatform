import { useLoaderData } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import ConcertList from '../components/ConcertList'
import Section from '../components/Section'

// Concerts route (WEB-03). Consumes build-time loader data; delegates rows
// and the D-12 empty state to ConcertList. Spacing and heading size come
// from <Section>.
export function Component() {
  const { events } = (useLoaderData() as { events?: BitEvent[] }) ?? {}

  return (
    <Section title="Upcoming Shows" eyebrow="Live" as="h1">
      <ConcertList events={events ?? []} />
    </Section>
  )
}

export default Component

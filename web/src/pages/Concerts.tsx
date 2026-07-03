import { useLoaderData } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import ConcertList from '../components/ConcertList'

// Concerts route (WEB-03). Consumes build-time loader data; delegates rows
// and the D-12 empty state to ConcertList.
export function Component() {
  const { events } = (useLoaderData() as { events?: BitEvent[] }) ?? {}

  return (
    <section>
      <h1 className="font-display text-3xl uppercase text-white">Upcoming Shows</h1>
      <ConcertList events={events ?? []} />
    </section>
  )
}

export default Component

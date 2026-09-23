import { useEffect, useState } from 'react'
import { dropPastEvents, type BitEvent } from '../lib/bandsintown'

/**
 * Hide events that went past since the last build.
 *
 * The concert list is baked into static HTML at build time, so the "upcoming"
 * cut-off is the build clock, not the visitor's. This re-applies the cut-off
 * against the visitor's clock — but only after mount: the first client render
 * must reproduce the server HTML exactly, or React discards the prerendered
 * tree on a hydration mismatch. Filtering in an effect costs one extra render
 * on a stale page and none on a fresh one.
 */
export function useUpcomingEvents(events: BitEvent[]): BitEvent[] {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return mounted ? dropPastEvents(events) : events
}

export default useUpcomingEvents

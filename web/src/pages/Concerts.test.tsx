import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import fixture from '../lib/__fixtures__/bandsintown-events.json'

const events = fixture as BitEvent[]

// The fixture is a snapshot of a real 2026 payload, and the page now filters
// out past dates (stale-build guard), so every render here needs an explicit
// clock. Only Date is faked — React's scheduler still uses real timers.
const pinClock = (iso: string) => vi.setSystemTime(new Date(iso))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  pinClock('2026-08-01T12:00:00') // before both fixture events
})

afterEach(() => {
  vi.useRealTimers()
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useLoaderData: vi.fn(),
  }
})

import { useLoaderData } from 'react-router-dom'
import { Component as Concerts } from './Concerts'

describe('Concerts page', () => {
  it('renders the "Upcoming Shows" heading and event rows from loader data', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Concerts />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /upcoming shows/i })).toBeInTheDocument()
    expect(screen.getByText(/Le Bikini/)).toBeInTheDocument()
  })

  it('renders the empty state when loader data has no events', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events: [] })

    render(
      <MemoryRouter>
        <Concerts />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /no shows scheduled/i })).toBeInTheDocument()
  })

  it('hides dates that passed since the build instead of advertising them', () => {
    // A build made before 2026-08-29 baked in both events; this visitor arrives
    // after the first one happened.
    pinClock('2026-09-01T12:00:00')
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Concerts />
      </MemoryRouter>,
    )

    expect(screen.queryByText(/Gravigny, France/)).not.toBeInTheDocument()
    expect(screen.getByText(/Le Bikini/)).toBeInTheDocument()
  })

  it('falls back to the empty state once every baked date has passed', () => {
    pinClock('2026-12-01T12:00:00')
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Concerts />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /no shows scheduled/i })).toBeInTheDocument()
  })
})

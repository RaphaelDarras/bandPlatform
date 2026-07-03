import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConcertList from './ConcertList'
import type { BitEvent } from '../lib/bandsintown'
import fixture from '../lib/__fixtures__/bandsintown-events.json'

const events = fixture as BitEvent[]

describe('ConcertList — empty state (D-12)', () => {
  it('renders "No shows scheduled" heading and a Bandsintown follow link', () => {
    render(<ConcertList events={[]} />)

    expect(screen.getByRole('heading', { name: /no shows scheduled/i })).toBeInTheDocument()
    expect(
      screen.getByText(/follow us on bandsintown to hear about new dates first/i),
    ).toBeInTheDocument()

    const followLink = screen.getByRole('link', { name: /bandsintown/i })
    expect(followLink).toHaveAttribute('href', expect.stringContaining('bandsintown.com/a/433176'))
  })
})

describe('ConcertList — populated (WEB-03)', () => {
  it('renders venue/city/country text for each event', () => {
    render(<ConcertList events={events} />)

    // Festival event: venue.name === title, so we expect location + title, not bare title alone twice.
    expect(screen.getByText(/Gravigny, France/)).toBeInTheDocument()
    expect(screen.getByText(/Le Bikini/)).toBeInTheDocument()
    expect(screen.getAllByText(/France/).length).toBeGreaterThanOrEqual(2)
  })

  it('renders a "Get Tickets" link only for events with offers, stripped of app_id', () => {
    render(<ConcertList events={events} />)

    const ticketLinks = screen.getAllByRole('link', { name: /get tickets/i })
    // Only the first fixture event has non-empty offers.
    expect(ticketLinks).toHaveLength(1)
    const href = ticketLinks[0].getAttribute('href') ?? ''
    expect(href).not.toContain('app_id')
  })

  it('never renders app_id in the document', () => {
    const { container } = render(<ConcertList events={events} />)
    expect(container.innerHTML).not.toContain('app_id')
  })
})

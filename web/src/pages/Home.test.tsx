import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import fixture from '../lib/__fixtures__/bandsintown-events.json'

const events = fixture as BitEvent[]

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useLoaderData: vi.fn(),
  }
})

import { useLoaderData } from 'react-router-dom'
import { Component as Home } from './Home'

describe('Home page', () => {
  it('renders "Listen Now" linking to /discography', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const listenNow = screen.getByRole('link', { name: /listen now/i })
    expect(listenNow).toHaveAttribute('href', '/discography')
  })

  it('shows the next event venue text from nextEvent(events) when events exist', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Gravigny, France/)).toBeInTheDocument()
  })

  it('degrades to "No shows scheduled" linking to /concerts when events is empty', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events: [] })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByText(/no shows scheduled/i)).toBeInTheDocument()
    const concertsLink = screen.getByRole('link', { name: /concerts/i })
    expect(concertsLink).toHaveAttribute('href', '/concerts')
  })

  it('renders a "Shop Merch" teaser section with a "Shop Now" link to /shop', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByText('Shop Merch')).toBeInTheDocument()
    const shopNow = screen.getByRole('link', { name: /shop now/i })
    expect(shopNow).toHaveAttribute('href', '/shop')
  })

  it('renders a "Get Tickets" link for the next event when offers exist, app_id stripped', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const ticketLink = screen.getByRole('link', { name: /get tickets/i })
    const href = ticketLink.getAttribute('href') ?? ''
    expect(href).not.toContain('app_id')
  })

  it('renders a latest-release teaser linking to /discography', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const discographyLinks = screen.getAllByRole('link', { name: /discography|listen/i })
    expect(discographyLinks.some((l) => l.getAttribute('href') === '/discography')).toBe(true)
  })
})

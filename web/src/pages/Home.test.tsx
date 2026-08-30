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
  it('renders "Listen Now" linking to /listen', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const listenNow = screen.getByRole('link', { name: /listen now/i })
    expect(listenNow).toHaveAttribute('href', '/listen')
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

  it('renders a "Shop Merch" teaser whose "Shop Now" link opens the Shopify storefront in a new tab', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByText('Shop Merch')).toBeInTheDocument()
    const shopNow = screen.getByRole('link', { name: /shop now/i })
    expect(shopNow).toHaveAttribute('href', 'https://shop.hurakanband.fr/')
    expect(shopNow).toHaveAttribute('target', '_blank')
    expect(shopNow).toHaveAttribute('rel', expect.stringContaining('noopener'))
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

  it('leads with a single h1 and orders sections release -> preorder -> show -> merch', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Hurakan')

    const sections = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(sections).toEqual([
      'Latest Release',
      'Preorder The Album',
      'Next Show',
      'Shop Merch',
    ])
  })

  it('routes every storefront link to the store root, never a deep link', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const storeLinks = [...container.querySelectorAll('a[href^="https://shop.hurakanband.fr"]')]
    expect(storeLinks).toHaveLength(3) // preorder CTA, merch thumbnail, Shop Now
    for (const l of storeLinks) {
      expect(l.getAttribute('href')).toBe('https://shop.hurakanband.fr/')
    }
  })

  it('gives the album preorder the only primary commerce CTA', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    // Preorder is filled; the merch link beside it is quiet, so the two asks
    // to the same URL never compete at equal weight.
    expect(screen.getByRole('link', { name: /preorder now/i }).className).toContain(
      'bg-[var(--color-accent)]',
    )
    expect(screen.getByRole('link', { name: /shop now/i }).className).not.toContain(
      'bg-[var(--color-accent)]',
    )
  })

  it('offers exactly one path to /listen from the page body (nav owns the other)', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(container.querySelectorAll('a[href="/listen"]')).toHaveLength(1)
  })

  it('renders a latest-release teaser linking to /listen', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const listenLinks = screen.getAllByRole('link', { name: /listen/i })
    expect(listenLinks.some((l) => l.getAttribute('href') === '/listen')).toBe(true)
  })
})

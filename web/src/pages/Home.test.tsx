import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import type { Catalogue } from '../lib/shopify'
import fixture from '../lib/__fixtures__/bandsintown-events.json'

const events = fixture as BitEvent[]

// The two slices partition the store — no handle appears in both.
const catalogue: Catalogue = {
  preorder: [
    {
      handle: 'preorder-cd-eternal-scars',
      label: 'DIGIPACK - "ETERNAL SCARS"',
      url: 'https://shop.hurakanband.fr/products/preorder-cd-eternal-scars',
      price: '15,00 €',
      image: 'https://cdn.shopify.com/s/files/1/x/CD.png?width=800',
      available: true,
    },
  ],
  merch: [
    {
      handle: 'parasite-t-shirt',
      label: 'PARASITE - T-SHIRT',
      url: 'https://shop.hurakanband.fr/products/parasite-t-shirt',
      price: '20,00 €',
      image: 'https://cdn.shopify.com/s/files/1/x/PARASITE.jpg?width=800',
      available: true,
    },
  ],
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useLoaderData: vi.fn(),
  }
})

import { useLoaderData } from 'react-router-dom'
import { Component as Home } from './Home'

const renderHome = () =>
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  )

describe('Home page', () => {
  it('leads with the release player itself, no poster or play overlay', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events, catalogue })
    const { container } = renderHome()

    const iframe = container.querySelector('iframe')!
    expect(iframe.getAttribute('src')).toContain('youtube-nocookie.com/embed/')
    expect(screen.queryByRole('button', { name: /play/i })).not.toBeInTheDocument()

    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Dogma')
  })

  it('splits the store into Preorder and Merch, in that order', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events, catalogue })
    renderHome()

    const sections = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(sections).toEqual(['Preorder', 'Merch', 'Next Show'])
  })

  it('lists no product twice across the two sections', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events, catalogue })
    const { container } = renderHome()

    const hrefs = [
      ...container.querySelectorAll('a[href^="https://shop.hurakanband.fr/products/"]'),
    ].map((a) => a.getAttribute('href'))

    expect(hrefs).toHaveLength(2)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('sends every product card to its own Shopify detail page', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events, catalogue })
    const { container } = renderHome()

    for (const a of container.querySelectorAll(
      'a[href^="https://shop.hurakanband.fr/products/"]',
    )) {
      expect(a.getAttribute('href')).toMatch(/\/products\/[a-z0-9-]+$/)
    }
  })

  it('keeps the store root to the single "Open the shop" button', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events, catalogue })
    const { container } = renderHome()

    const rootLinks = [...container.querySelectorAll('a[href="https://shop.hurakanband.fr/"]')]
    expect(rootLinks).toHaveLength(1)
    expect(rootLinks[0]).toHaveTextContent(/open the shop/i)
  })

  it('falls back to a plain shop link when the catalogue fetch failed soft', () => {
    vi.mocked(useLoaderData).mockReturnValue({
      events,
      catalogue: { preorder: [], merch: [] },
    })
    const { container } = renderHome()

    expect(screen.queryByRole('heading', { name: /^preorder$/i })).not.toBeInTheDocument()
    expect(
      container.querySelectorAll('a[href^="https://shop.hurakanband.fr/products/"]'),
    ).toHaveLength(0)
    expect(screen.getByRole('link', { name: /open the shop/i })).toHaveAttribute(
      'href',
      'https://shop.hurakanband.fr/',
    )
  })

  it('shows the next event venue text from nextEvent(events) when events exist', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events, catalogue })
    renderHome()

    // The venue heading and the city/country line are separate elements, and
    // for a festival venueDisplay() includes the location, so this string
    // legitimately appears in both.
    expect(screen.getAllByText(/Gravigny, France/).length).toBeGreaterThanOrEqual(1)
  })

  it('degrades to "No shows scheduled" linking to /concerts when events is empty', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events: [], catalogue })
    renderHome()

    expect(screen.getByText(/no shows scheduled/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /all concerts/i })).toHaveAttribute(
      'href',
      '/concerts',
    )
  })

  it('renders a "Get Tickets" link for the next event when offers exist, app_id stripped', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events, catalogue })
    renderHome()

    const href = screen.getByRole('link', { name: /get tickets/i }).getAttribute('href') ?? ''
    expect(href).not.toContain('app_id')
  })
})

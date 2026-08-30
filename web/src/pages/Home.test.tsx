import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import type { Catalogue } from '../lib/shopify'
import fixture from '../lib/__fixtures__/bandsintown-events.json'

const events = fixture as BitEvent[]

const catalogue: Catalogue = {
  preorder: [
    {
      handle: 'preorder-cd-eternal-scars',
      label: 'DIGIPACK - "ETERNAL SCARS"',
      url: 'https://shop.hurakanband.fr/products/preorder-cd-eternal-scars',
      price: '15,00 €',
      image: 'https://cdn.shopify.com/s/files/1/x/CD.png?width=800',
      available: true,
      isPreorder: true,
    },
  ],
  all: [
    {
      handle: 'preorder-cd-eternal-scars',
      label: 'DIGIPACK - "ETERNAL SCARS"',
      url: 'https://shop.hurakanband.fr/products/preorder-cd-eternal-scars',
      price: '15,00 €',
      image: 'https://cdn.shopify.com/s/files/1/x/CD.png?width=800',
      available: true,
      isPreorder: true,
    },
    {
      handle: 'parasite-t-shirt',
      label: 'PARASITE - T-SHIRT',
      url: 'https://shop.hurakanband.fr/products/parasite-t-shirt',
      price: '20,00 €',
      image: 'https://cdn.shopify.com/s/files/1/x/PARASITE.jpg?width=800',
      available: true,
      isPreorder: false,
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
  it('renders "Listen Now" linking to /listen', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events, catalogue })
    renderHome()

    expect(screen.getByRole('link', { name: /listen now/i })).toHaveAttribute('href', '/listen')
  })

  it('leads with a full-screen deferred player as the page h1', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events, catalogue })
    const { container } = renderHome()

    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Dogma')

    // Nothing third-party loads until the visitor asks for it.
    expect(container.querySelector('iframe')).toBeNull()
    expect(screen.getByRole('button', { name: /play video/i })).toBeInTheDocument()
  })

  it('splits merch into a Preorder section and an All section', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events, catalogue })
    renderHome()

    const sections = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(sections).toEqual(['Preorder', 'All', 'Next Show'])
  })

  it('sends every product card to its own Shopify detail page', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events, catalogue })
    const { container } = renderHome()

    const productLinks = [
      ...container.querySelectorAll('a[href^="https://shop.hurakanband.fr/products/"]'),
    ]
    // 1 in Preorder + 2 in All.
    expect(productLinks).toHaveLength(3)
    for (const l of productLinks) {
      expect(l.getAttribute('href')).toMatch(/\/products\/[a-z0-9-]+$/)
    }
  })

  it('keeps the store root to the single "everything" button', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events, catalogue })
    const { container } = renderHome()

    const rootLinks = [
      ...container.querySelectorAll('a[href="https://shop.hurakanband.fr/"]'),
    ]
    expect(rootLinks).toHaveLength(1)
    expect(rootLinks[0]).toHaveTextContent(/open the shop/i)
  })

  it('falls back to a plain shop link when the catalogue fetch failed soft', () => {
    vi.mocked(useLoaderData).mockReturnValue({
      events,
      catalogue: { preorder: [], all: [] },
    })
    const { container } = renderHome()

    expect(screen.queryByRole('heading', { name: /^preorder$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^all$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open the shop/i })).toHaveAttribute(
      'href',
      'https://shop.hurakanband.fr/',
    )
    expect(
      container.querySelectorAll('a[href^="https://shop.hurakanband.fr/products/"]'),
    ).toHaveLength(0)
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

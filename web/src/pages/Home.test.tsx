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

  it('carries no general merch teaser — the storefront ask is the preorder alone', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.queryByText(/shop merch/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /shop now/i })).not.toBeInTheDocument()
  })

  it('sends its one storefront link to the store root in a new tab', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const preorder = screen.getByRole('link', { name: /preorder now/i })
    expect(preorder).toHaveAttribute('href', 'https://shop.hurakanband.fr/')
    expect(preorder).toHaveAttribute('target', '_blank')
    expect(preorder).toHaveAttribute('rel', expect.stringContaining('noopener'))
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

  it('leads with a single h1 and orders sections release -> preorder -> show', () => {
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
    expect(sections).toEqual(['Latest Release', 'Preorder The Album', 'Next Show'])
  })

  it('routes every storefront link to the store root, never a deep link', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const storeLinks = [...container.querySelectorAll('a[href^="https://shop.hurakanband.fr"]')]
    expect(storeLinks).toHaveLength(1) // the preorder CTA
    expect(storeLinks[0].getAttribute('href')).toBe('https://shop.hurakanband.fr/')
  })

  it('keeps the hero to the banner and the wordmark, with no tagline', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const hero = container.querySelector('h1')!.closest('section')!
    expect(hero.querySelectorAll('p')).toHaveLength(0)
    expect(hero.querySelector('img')).not.toBeNull()
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

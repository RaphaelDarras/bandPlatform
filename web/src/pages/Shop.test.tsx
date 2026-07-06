import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Product } from '@bandplatform/shared'

vi.mock('../lib/products', () => ({
  fetchProducts: vi.fn(),
}))

import { fetchProducts } from '../lib/products'
import { Component as Shop } from './Shop'

const products: Product[] = [
  {
    id: '1',
    name: 'Tour Shirt',
    basePrice: 25,
    images: ['https://example.com/shirt.jpg'],
    active: true,
    variants: [],
  },
]

function renderShop() {
  return render(
    <MemoryRouter>
      <Shop />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Shop page', () => {
  it('renders the "Shop" heading and a catalog skeleton while the fetch is pending', () => {
    vi.mocked(fetchProducts).mockReturnValue(new Promise(() => {}))

    renderShop()

    expect(screen.getByRole('heading', { name: /^shop$/i })).toBeInTheDocument()
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    // Cold-start note is not shown immediately.
    expect(screen.queryByText(/up to a minute/i)).not.toBeInTheDocument()
  })

  it('renders the product grid on successful fetch', async () => {
    vi.mocked(fetchProducts).mockResolvedValue(products)

    renderShop()

    await waitFor(() => expect(screen.getByText('Tour Shirt')).toBeInTheDocument())
    expect(screen.getAllByText(/€/).length).toBeGreaterThan(0)
  })

  it('renders the error/retry state when the fetch rejects', async () => {
    vi.mocked(fetchProducts).mockRejectedValue(new Error('boom'))

    renderShop()

    expect(
      await screen.findByRole('heading', { name: /couldn't load the shop/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/store may be waking up or having trouble connecting/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('shows the cold-start note after ~5s while still loading, without removing the skeleton (D-10)', async () => {
    vi.useFakeTimers()
    vi.mocked(fetchProducts).mockReturnValue(new Promise(() => {}))

    renderShop()

    expect(screen.queryByText(/up to a minute/i)).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(screen.getByText(/up to a minute/i)).toBeInTheDocument()
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })
})

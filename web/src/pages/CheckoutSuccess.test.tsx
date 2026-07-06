import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useCartStore, type CartLine } from '../lib/cartStore'
import { Component as CheckoutSuccess } from './CheckoutSuccess'

// Optimistic success page tests (D-15): renders the query-string order
// number, clears the cart exactly once on mount, and makes no API fetch
// (no polling for webhook completion).

const shirtLine: CartLine = {
  productId: 'p1',
  variantSku: 'TS-M-BLK',
  quantity: 2,
  name: 'Tour Shirt',
  variantLabel: 'M / Black',
  unitPrice: 25,
  image: 'https://example.com/shirt.jpg',
}

function renderSuccess(search = '?order=HRK-ABC123') {
  return render(
    <MemoryRouter initialEntries={[`/checkout/success${search}`]}>
      <CheckoutSuccess />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useCartStore.setState({ lines: [shirtLine], hasHydrated: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('CheckoutSuccess page', () => {
  it('renders the order number from the query string', () => {
    renderSuccess()

    expect(screen.getByText(/HRK-ABC123/)).toBeInTheDocument()
  })

  it('calls clearCart exactly once on mount', () => {
    const clearCartSpy = vi.spyOn(useCartStore.getState(), 'clearCart')

    renderSuccess()

    expect(clearCartSpy).toHaveBeenCalledTimes(1)
    expect(useCartStore.getState().lines).toEqual([])
  })

  it('performs no API fetch', () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    renderSuccess()

    expect(mockFetch).not.toHaveBeenCalled()
  })
})

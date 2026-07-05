import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/cartStore', () => ({
  useCartStore: vi.fn(),
}))

import { useCartStore } from '../lib/cartStore'
import Header from './Header'

function mockCartLines(quantities: number[]) {
  vi.mocked(useCartStore).mockImplementation((selector) =>
    selector({
      lines: quantities.map((quantity, i) => ({
        productId: `p${i}`,
        variantSku: `sku${i}`,
        quantity,
        name: `Product ${i}`,
        variantLabel: 'M',
        unitPrice: 10,
        image: '',
      })),
      hasHydrated: true,
      setHasHydrated: vi.fn(),
      addLine: vi.fn(),
      setQuantity: vi.fn(),
      removeLine: vi.fn(),
      clearCart: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any),
  )
}

describe('Header', () => {
  it('renders the Shop nav link', () => {
    mockCartLines([])

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    const shopLinks = screen.getAllByRole('link', { name: /shop/i })
    expect(shopLinks.some((l) => l.getAttribute('href') === '/shop')).toBe(true)
  })

  it('renders a persistent cart link to /cart', () => {
    mockCartLines([])

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    const cartLink = screen.getByLabelText('Cart')
    expect(cartLink).toHaveAttribute('href', '/cart')
  })

  it('shows a count badge and "Cart, {n} items" aria-label when itemCount > 0', () => {
    mockCartLines([2, 1])

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    const cartLink = screen.getByLabelText('Cart, 3 items')
    expect(cartLink).toHaveAttribute('href', '/cart')
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('hides the badge and uses aria-label "Cart" when the cart is empty', () => {
    mockCartLines([])

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('Cart')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})

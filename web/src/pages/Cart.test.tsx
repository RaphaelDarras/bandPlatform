import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Product } from '@bandplatform/shared'

vi.mock('../lib/products', () => ({
  fetchProducts: vi.fn(),
}))

import { fetchProducts } from '../lib/products'
import { useCartStore, type CartLine } from '../lib/cartStore'
import { Component as Cart } from './Cart'

const shirtLine: CartLine = {
  productId: 'p1',
  variantSku: 'TS-M-BLK',
  quantity: 2,
  name: 'Tour Shirt',
  variantLabel: 'M / Black',
  unitPrice: 25,
  image: 'https://example.com/shirt.jpg',
}

const hoodieLine: CartLine = {
  productId: 'p2',
  variantSku: 'HD-L-BLK',
  quantity: 1,
  name: 'Tour Hoodie',
  variantLabel: 'L / Black',
  unitPrice: 60,
  image: 'https://example.com/hoodie.jpg',
}

function productsFor(lines: CartLine[], stockByVariant: Record<string, number>): Product[] {
  const byProduct = new Map<string, CartLine[]>()
  for (const line of lines) {
    byProduct.set(line.productId, [...(byProduct.get(line.productId) ?? []), line])
  }
  return Array.from(byProduct.entries()).map(([productId, ls]) => ({
    id: productId,
    name: ls[0].name,
    basePrice: ls[0].unitPrice,
    images: [ls[0].image],
    active: true,
    variants: ls.map((l) => ({
      sku: l.variantSku,
      stock: stockByVariant[l.variantSku] ?? l.quantity,
      version: 1,
      priceAdjustment: 0,
    })),
  }))
}

function renderCart() {
  return render(
    <MemoryRouter>
      <Cart />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useCartStore.setState({ lines: [], hasHydrated: false })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Cart page', () => {
  it('renders the empty-cart state with a Browse Shop link when hydrated with no lines', () => {
    useCartStore.setState({ lines: [], hasHydrated: true })
    vi.mocked(fetchProducts).mockResolvedValue([])

    renderCart()

    expect(screen.getByRole('heading', { name: /your cart is empty/i })).toBeInTheDocument()
    expect(
      screen.getByText(/looks like you haven't added anything yet/i),
    ).toBeInTheDocument()
    const browseLink = screen.getByRole('link', { name: /browse shop/i })
    expect(browseLink).toHaveAttribute('href', '/shop')
  })

  it('renders populated cart lines with thumbnail, name, variant, price, stepper, and line total', async () => {
    useCartStore.setState({ lines: [shirtLine, hoodieLine], hasHydrated: true })
    vi.mocked(fetchProducts).mockResolvedValue(
      productsFor([shirtLine, hoodieLine], { 'TS-M-BLK': 8, 'HD-L-BLK': 5 }),
    )

    renderCart()

    await waitFor(() => expect(screen.getByText('Tour Shirt')).toBeInTheDocument())
    expect(screen.getByText('Tour Hoodie')).toBeInTheDocument()

    const shirtRow = screen.getByText('Tour Shirt').closest('li') as HTMLElement
    expect(within(shirtRow).getByText('M / Black')).toBeInTheDocument()
    expect(within(shirtRow).getByAltText('Tour Shirt')).toBeInTheDocument()
    expect(within(shirtRow).getByText('€50')).toBeInTheDocument() // 25 * 2
    expect(within(shirtRow).getByLabelText('Increase quantity')).toBeInTheDocument()
    expect(
      within(shirtRow).getByLabelText('Remove Tour Shirt from cart'),
    ).toBeInTheDocument()
  })

  it('flags a line whose quantity exceeds live stock, blocking checkout', async () => {
    useCartStore.setState({ lines: [shirtLine], hasHydrated: true })
    // Live stock is only 1, but the cart line quantity is 2 — over-stock.
    vi.mocked(fetchProducts).mockResolvedValue(
      productsFor([shirtLine], { 'TS-M-BLK': 1 }),
    )

    renderCart()

    await waitFor(() =>
      expect(screen.getByText(/no longer available in this quantity/i)).toBeInTheDocument(),
    )

    const shirtRow = screen.getByText('Tour Shirt').closest('li') as HTMLElement
    expect(shirtRow.className).toMatch(/border-\[#ef4444\]/)
    expect(
      within(shirtRow).getByLabelText('Update quantity for Tour Shirt'),
    ).toBeInTheDocument()
    expect(
      within(shirtRow).getByLabelText('Remove Tour Shirt from cart'),
    ).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /checkout/i })).toBeDisabled()
    expect(
      screen.getByText(/resolve the flagged items above to continue/i),
    ).toBeInTheDocument()

    // No silent auto-adjust (D-14): the stored quantity is untouched.
    expect(
      useCartStore.getState().lines.find((l) => l.variantSku === 'TS-M-BLK')?.quantity,
    ).toBe(2)
  })

  it('flags a line whose variant is out of stock (0), blocking checkout', async () => {
    useCartStore.setState({ lines: [shirtLine], hasHydrated: true })
    vi.mocked(fetchProducts).mockResolvedValue(
      productsFor([shirtLine], { 'TS-M-BLK': 0 }),
    )

    renderCart()

    await waitFor(() =>
      expect(screen.getByText(/no longer available in this quantity/i)).toBeInTheDocument(),
    )

    expect(screen.getByRole('button', { name: /checkout/i })).toBeDisabled()
  })

  it('enables the Checkout link to /checkout when no line is flagged', async () => {
    useCartStore.setState({ lines: [shirtLine], hasHydrated: true })
    vi.mocked(fetchProducts).mockResolvedValue(
      productsFor([shirtLine], { 'TS-M-BLK': 8 }),
    )

    renderCart()

    await waitFor(() => expect(screen.getByText('Tour Shirt')).toBeInTheDocument())

    const checkoutLink = await screen.findByRole('link', { name: /checkout/i })
    expect(checkoutLink).toHaveAttribute('href', '/checkout')
    expect(screen.queryByText(/resolve the flagged items above/i)).not.toBeInTheDocument()
  })

  it('shows the subtotal as the sum of unitPrice * quantity across all lines', async () => {
    useCartStore.setState({ lines: [shirtLine, hoodieLine], hasHydrated: true })
    vi.mocked(fetchProducts).mockResolvedValue(
      productsFor([shirtLine, hoodieLine], { 'TS-M-BLK': 8, 'HD-L-BLK': 5 }),
    )

    renderCart()

    // shirt: 25*2=50, hoodie: 60*1=60 -> subtotal 110
    await waitFor(() => expect(screen.getByText(/subtotal.*€?110/i)).toBeInTheDocument())
  })
})

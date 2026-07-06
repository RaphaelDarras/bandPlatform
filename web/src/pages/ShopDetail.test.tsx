import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { Product } from '@bandplatform/shared'

vi.mock('../lib/products', () => ({
  fetchProduct: vi.fn(),
}))

import { fetchProduct } from '../lib/products'
import { useCartStore } from '../lib/cartStore'
import { Component as ShopDetail } from './ShopDetail'

const product: Product = {
  id: 'p1',
  name: 'Tour Shirt',
  description: 'A great shirt',
  basePrice: 25,
  images: ['https://example.com/shirt-1.jpg', 'https://example.com/shirt-2.jpg'],
  active: true,
  variants: [
    { sku: 'TS-M-BLK', size: 'M', color: 'Black', stock: 8, version: 1, priceAdjustment: 0 },
    { sku: 'TS-L-BLK', size: 'L', color: 'Black', stock: 0, version: 1, priceAdjustment: 5 },
  ],
}

function renderDetail(productId = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/shop/${productId}`]}>
      <Routes>
        <Route path="/shop/:id" element={<ShopDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useCartStore.setState({ lines: [], hasHydrated: false })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ShopDetail page', () => {
  it('fetches the product on mount and renders its name', async () => {
    vi.mocked(fetchProduct).mockResolvedValue(product)

    renderDetail()

    expect(fetchProduct).toHaveBeenCalledWith('p1')
    await waitFor(() => expect(screen.getByText('Tour Shirt')).toBeInTheDocument())
  })

  it('renders the error/retry state when the fetch rejects', async () => {
    vi.mocked(fetchProduct).mockRejectedValue(new Error('boom'))

    renderDetail()

    expect(
      await screen.findByRole('heading', { name: /couldn't load the shop/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('disables quantity and Add to Cart, and shows no StockBadge before a variant is selected', async () => {
    vi.mocked(fetchProduct).mockResolvedValue(product)

    renderDetail()

    await waitFor(() => expect(screen.getByText('Tour Shirt')).toBeInTheDocument())

    expect(screen.queryByText(/in stock|low stock|out of stock/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled()
    expect(screen.getByLabelText('Decrease quantity')).toBeDisabled()
    expect(screen.getByLabelText('Increase quantity')).toBeDisabled()
  })

  it('enables the stepper/Add to Cart and shows StockBadge + adjusted price after selecting an in-stock variant', async () => {
    vi.mocked(fetchProduct).mockResolvedValue(product)

    renderDetail()

    await waitFor(() => expect(screen.getByText('Tour Shirt')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'M / Black' }))

    expect(screen.getByText(/in stock/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeEnabled()
    expect(screen.getByLabelText('Increase quantity')).toBeEnabled()
    expect(screen.getByText('€25')).toBeInTheDocument()
  })

  it('renders an out-of-stock variant as disabled/muted and not selectable', async () => {
    vi.mocked(fetchProduct).mockResolvedValue(product)

    renderDetail()

    await waitFor(() => expect(screen.getByText('Tour Shirt')).toBeInTheDocument())

    const outOfStockButton = screen.getByRole('button', { name: 'L / Black' })
    expect(outOfStockButton).toBeDisabled()
    expect(outOfStockButton.className).toMatch(/opacity-40/)
    expect(outOfStockButton.className).toMatch(/cursor-not-allowed/)

    fireEvent.click(outOfStockButton)
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled()
  })

  it('calls addLine with the correct payload and stockCap when Add to Cart is clicked', async () => {
    vi.mocked(fetchProduct).mockResolvedValue(product)

    renderDetail()

    await waitFor(() => expect(screen.getByText('Tour Shirt')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'M / Black' }))
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }))

    const lines = useCartStore.getState().lines
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      productId: 'p1',
      variantSku: 'TS-M-BLK',
      quantity: 1,
      name: 'Tour Shirt',
      variantLabel: 'M / Black',
      unitPrice: 25,
      image: 'https://example.com/shirt-1.jpg',
    })
  })

  it('gallery: clicking a thumbnail swaps the primary image', async () => {
    vi.mocked(fetchProduct).mockResolvedValue(product)

    renderDetail()

    await waitFor(() => expect(screen.getByText('Tour Shirt')).toBeInTheDocument())

    const primary = screen.getByAltText('Tour Shirt') as HTMLImageElement
    expect(primary.src).toContain('shirt-1.jpg')

    fireEvent.click(screen.getByRole('button', { name: 'View image 2' }))

    expect((screen.getByAltText('Tour Shirt') as HTMLImageElement).src).toContain('shirt-2.jpg')
  })

  it('shows a single placeholder tile when images[] is empty', async () => {
    vi.mocked(fetchProduct).mockResolvedValue({ ...product, images: [] })

    renderDetail()

    await waitFor(() => expect(screen.getByText('Tour Shirt')).toBeInTheDocument())

    expect(screen.queryByAltText('Tour Shirt')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /view image/i })).not.toBeInTheDocument()
  })
})

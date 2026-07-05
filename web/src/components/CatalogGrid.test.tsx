import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CatalogGrid from './CatalogGrid'
import type { Product } from '@bandplatform/shared'

const baseProduct: Product = {
  id: '1',
  name: 'Tour Shirt',
  basePrice: 25,
  images: ['https://example.com/shirt.jpg'],
  active: true,
  variants: [],
}

function renderGrid(products: Product[]) {
  return render(
    <MemoryRouter>
      <CatalogGrid products={products} />
    </MemoryRouter>,
  )
}

describe('CatalogGrid — populated (SHOP-01/SHOP-07)', () => {
  it('renders a card per product with image, name, price (CAD), and a link to the detail page', () => {
    const products: Product[] = [
      { ...baseProduct, id: '1', name: 'Tour Shirt' },
      { ...baseProduct, id: '2', name: 'Hoodie' },
      { ...baseProduct, id: '3', name: 'Cap' },
    ]
    const { container } = renderGrid(products)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveAttribute('href', '/shop/1')
    expect(links[1]).toHaveAttribute('href', '/shop/2')
    expect(links[2]).toHaveAttribute('href', '/shop/3')

    expect(screen.getByText('Tour Shirt')).toBeInTheDocument()
    expect(screen.getAllByText(/CAD/)).toHaveLength(3)

    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(3)
    expect(imgs[0]).toHaveAttribute('src', baseProduct.images[0])
  })

  it('renders the branded placeholder (not an empty <img src>) when images is an empty array', () => {
    const { container } = renderGrid([{ ...baseProduct, images: [] }])

    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0].getAttribute('src')).toBe('/images/HURAKAN_SLAM_ICON_inverted.png')
  })

  it('renders the branded placeholder when images[0] is an empty string (Pitfall 4)', () => {
    const { container } = renderGrid([{ ...baseProduct, images: [''] }])

    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0].getAttribute('src')).toBe('/images/HURAKAN_SLAM_ICON_inverted.png')
  })

  it('grid container has responsive classes', () => {
    const { container } = renderGrid([baseProduct])
    const grid = container.querySelector('.grid')
    expect(grid?.className).toContain('grid-cols-2')
    expect(grid?.className).toContain('sm:grid-cols-3')
    expect(grid?.className).toContain('lg:grid-cols-4')
  })
})

describe('CatalogGrid — empty state', () => {
  it('renders "No products yet" heading and body copy when products is empty', () => {
    renderGrid([])

    expect(screen.getByRole('heading', { name: /no products yet/i })).toBeInTheDocument()
    expect(screen.getByText(/merch is on its way — check back soon/i)).toBeInTheDocument()
  })
})

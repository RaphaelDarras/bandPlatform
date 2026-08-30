import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProductGrid from './ProductGrid'
import type { ShopProduct } from '../lib/shopify'

const products: ShopProduct[] = [
  {
    handle: 'preorder-cd-eternal-scars',
    label: 'DIGIPACK - "ETERNAL SCARS"',
    url: 'https://shop.hurakanband.fr/products/preorder-cd-eternal-scars',
    price: '15,00 €',
    image: 'https://cdn.shopify.com/s/files/1/x/CD_MOCKUP.png?v=1&width=800',
    available: true,
  },
  {
    handle: 'parasite-t-shirt',
    label: 'PARASITE - T-SHIRT',
    url: 'https://shop.hurakanband.fr/products/parasite-t-shirt',
    price: '20,00 €',
    image: null,
    available: false,
  },
]

describe('ProductGrid', () => {
  it('links every card to its own product detail page, in a new tab', () => {
    render(<ProductGrid products={products} />)

    const cd = screen.getByRole('link', { name: /digipack/i })
    expect(cd).toHaveAttribute(
      'href',
      'https://shop.hurakanband.fr/products/preorder-cd-eternal-scars',
    )
    expect(cd).toHaveAttribute('target', '_blank')
    expect(cd.getAttribute('rel')).toContain('noopener')
  })

  it('never links a card to the bare store root', () => {
    const { container } = render(<ProductGrid products={products} />)

    for (const a of container.querySelectorAll('a')) {
      expect(a.getAttribute('href')).toContain('/products/')
    }
  })

  it('shows the price when available and marks sold-out items', () => {
    render(<ProductGrid products={products} />)

    expect(screen.getByText('15,00 €')).toBeInTheDocument()
    expect(screen.getByText(/sold out/i)).toBeInTheDocument()
    expect(screen.queryByText('20,00 €')).not.toBeInTheDocument()
  })

  it('lazy-loads thumbnails and omits the img entirely when there is none', () => {
    const { container } = render(<ProductGrid products={products} />)

    const imgs = [...container.querySelectorAll('img')]
    expect(imgs).toHaveLength(1) // the t-shirt has image: null
    expect(imgs[0]).toHaveAttribute('loading', 'lazy')
    expect(imgs[0]).toHaveAttribute('alt', 'DIGIPACK - "ETERNAL SCARS"')
  })

  it('puts no fill on the grid itself, so an incomplete last row shows nothing', () => {
    // Regression: the grid used gap-px over a hairline background to fake 1px
    // separators. With 13 items in a 4-column grid the 3 empty trailing cells
    // rendered that fill as a visible block in the wrong colour.
    const { container } = render(<ProductGrid products={products} />)

    const ul = container.querySelector('ul')!
    expect(ul.className).not.toMatch(/\bbg-/)
    expect(ul.className).not.toContain('gap-px')

    // The separators come from each card's own border instead.
    for (const a of container.querySelectorAll('a')) {
      expect(a.className).toContain('border-[var(--color-hairline)]')
    }
  })

  it('renders an empty list when given no products', () => {
    const { container } = render(<ProductGrid products={[]} />)

    expect(container.querySelectorAll('li')).toHaveLength(0)
  })
})

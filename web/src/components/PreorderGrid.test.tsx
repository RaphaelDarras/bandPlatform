import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PreorderGrid from './PreorderGrid'
import type { PreorderProduct } from '../lib/shopify'

const products: PreorderProduct[] = [
  {
    handle: 'preorder-cd-eternal-scars',
    label: 'Digipack CD',
    url: 'https://shop.hurakanband.fr/products/preorder-cd-eternal-scars',
    price: '15,00 €',
    image: 'https://cdn.shopify.com/s/files/1/x/CD_MOCKUP.png?v=1&width=600',
    available: true,
  },
  {
    handle: 'preorder-vinyl-eternal-scars-black',
    label: 'Vinyl — Black',
    url: 'https://shop.hurakanband.fr/products/preorder-vinyl-eternal-scars-black',
    price: '30,00 €',
    image: null,
    available: false,
  },
]

describe('PreorderGrid', () => {
  it('renders one deep-linked card per product, opening in a new tab', () => {
    render(<PreorderGrid products={products} />)

    const cd = screen.getByRole('link', { name: /digipack cd/i })
    expect(cd).toHaveAttribute(
      'href',
      'https://shop.hurakanband.fr/products/preorder-cd-eternal-scars',
    )
    expect(cd).toHaveAttribute('target', '_blank')
    expect(cd.getAttribute('rel')).toContain('noopener')
  })

  it('shows the price when available and "Sold out" when not', () => {
    render(<PreorderGrid products={products} />)

    expect(screen.getByText('15,00 €')).toBeInTheDocument()
    expect(screen.getByText(/sold out/i)).toBeInTheDocument()
    expect(screen.queryByText('30,00 €')).not.toBeInTheDocument()
  })

  it('lazy-loads thumbnails and omits the img entirely when there is none', () => {
    const { container } = render(<PreorderGrid products={products} />)

    const imgs = [...container.querySelectorAll('img')]
    expect(imgs).toHaveLength(1) // the vinyl has image: null
    expect(imgs[0]).toHaveAttribute('loading', 'lazy')
    expect(imgs[0]).toHaveAttribute('alt', 'Digipack CD')
  })

  it('renders nothing but an empty list when given no products', () => {
    const { container } = render(<PreorderGrid products={[]} />)

    expect(container.querySelectorAll('li')).toHaveLength(0)
  })
})

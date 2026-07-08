import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Header from './Header'

describe('Header', () => {
  it('renders the Shop nav link to the external Shopify storefront in a new tab', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    const shopLinks = screen.getAllByRole('link', { name: /shop/i })
    const external = shopLinks.find(
      (l) => l.getAttribute('href') === 'https://shop.hurakanband.fr/',
    )
    expect(external).toBeDefined()
    expect(external).toHaveAttribute('target', '_blank')
    expect(external).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('no longer renders a cart link', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Component as Contact } from './Contact'

describe('Contact page', () => {
  it('renders a mailto link and the Bandsintown link', () => {
    const { container } = render(<Contact />)

    const mailtoLink = container.querySelector('a[href^="mailto:"]')
    expect(mailtoLink).toBeInTheDocument()

    const bandsintownLink = screen.getByRole('link', { name: /bandsintown/i })
    expect(bandsintownLink).toHaveAttribute('href', 'https://www.bandsintown.com/a/433176')
  })

  it('renders an Instagram link', () => {
    const instagramLink = (() => {
      render(<Contact />)
      return screen.getByRole('link', { name: /instagram/i })
    })()
    expect(instagramLink).toBeInTheDocument()
  })

  it('renders two distinct contact channels: general and booking/press', () => {
    render(<Contact />)

    expect(screen.getByRole('heading', { name: /^general$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /booking.*press/i })).toBeInTheDocument()
  })

  it('renders no contact form (D-13)', () => {
    const { container } = render(<Contact />)
    expect(container.querySelector('form')).not.toBeInTheDocument()
  })
})

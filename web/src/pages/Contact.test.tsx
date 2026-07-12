import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Component as Contact } from './Contact'

describe('Contact page', () => {
  it('renders the band email as a mailto link', () => {
    const { container } = render(<Contact />)

    const mailtoLink = container.querySelector('a[href^="mailto:"]')
    expect(mailtoLink).toHaveAttribute('href', 'mailto:hurakanband@gmail.com')
  })

  it('renders Instagram, Spotify, and Shop links', () => {
    render(<Contact />)

    expect(screen.getByRole('link', { name: /instagram/i })).toHaveAttribute(
      'href',
      'https://www.instagram.com/hurakanband/',
    )
    expect(screen.getByRole('link', { name: /spotify/i })).toHaveAttribute(
      'href',
      'https://open.spotify.com/artist/5w35Gt5153qhoSwR4MVtEU',
    )
    expect(screen.getByRole('link', { name: /shop/i })).toHaveAttribute(
      'href',
      'https://shop.hurakanband.fr/',
    )
  })

  it('renders no contact form (D-13)', () => {
    const { container } = render(<Contact />)
    expect(container.querySelector('form')).not.toBeInTheDocument()
  })
})

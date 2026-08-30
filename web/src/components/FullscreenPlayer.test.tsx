import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FullscreenPlayer from './FullscreenPlayer'

const props = {
  videoId: 'P5whjxluBpo',
  poster: '/images/FB_DOGMA.jpg',
  posterWide: '/images/BANDCAMP_DOGMA.avif',
  title: 'Dogma',
}

describe('FullscreenPlayer', () => {
  it('defers the iframe: nothing third-party is in the document before play', () => {
    const { container } = render(<FullscreenPlayer {...props} />)

    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('img')).not.toBeNull()
    expect(screen.getByRole('button', { name: /play video/i })).toBeInTheDocument()
  })

  it('swaps in a nocookie autoplay iframe once play is pressed', () => {
    const { container } = render(<FullscreenPlayer {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /play video/i }))

    const iframe = container.querySelector('iframe')!
    expect(iframe).not.toBeNull()
    const src = iframe.getAttribute('src') ?? ''
    expect(src).toContain('youtube-nocookie.com/embed/P5whjxluBpo')
    expect(src).toContain('autoplay=1')
    expect(container.querySelector('img')).toBeNull()
  })

  it('fills the viewport height', () => {
    const { container } = render(<FullscreenPlayer {...props} />)

    expect(container.querySelector('section')!.style.height).toBe('100svh')
  })

  it('offers the wide poster to viewports above 640px', () => {
    const { container } = render(<FullscreenPlayer {...props} />)

    const source = container.querySelector('source')!
    expect(source.getAttribute('media')).toContain('640px')
    expect(source.getAttribute('srcset')).toBe('/images/BANDCAMP_DOGMA.avif')
  })

  it('renders the title as the page h1 and an optional action beside play', () => {
    render(<FullscreenPlayer {...props} action={<a href="/listen">Listen Now</a>} />)

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Dogma')
    expect(screen.getByRole('link', { name: /listen now/i })).toHaveAttribute('href', '/listen')
  })
})

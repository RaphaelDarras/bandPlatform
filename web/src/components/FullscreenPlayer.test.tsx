import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FullscreenPlayer from './FullscreenPlayer'

const props = { videoId: 'P5whjxluBpo', title: 'Dogma' }

describe('FullscreenPlayer', () => {
  it('shows the player directly — no poster image and no play overlay', () => {
    const { container } = render(<FullscreenPlayer {...props} />)

    expect(container.querySelector('iframe')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('picture')).toBeNull()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('embeds via youtube-nocookie and does not autoplay', () => {
    const { container } = render(<FullscreenPlayer {...props} />)

    const src = container.querySelector('iframe')!.getAttribute('src') ?? ''
    expect(src).toContain('youtube-nocookie.com/embed/P5whjxluBpo')
    expect(src).not.toContain('autoplay=1')
  })

  it('goes full-bleed at 16:9 so the video fills its frame without bars', () => {
    const { container } = render(<FullscreenPlayer {...props} />)

    expect(container.querySelector('section')!.className).toContain('full-bleed')
    expect(container.querySelector('iframe')!.className).toContain('aspect-video')
    expect(container.querySelector('iframe')!.className).toContain('w-full')
  })

  it('keeps the title as an accessible h1 even though nothing shows it', () => {
    const { container } = render(<FullscreenPlayer {...props} />)

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Dogma')
    expect(h1.className).toContain('sr-only')
    expect(container.querySelector('iframe')!.getAttribute('title')).toBe('Dogma')
  })
})

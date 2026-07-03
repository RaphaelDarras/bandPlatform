import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import YouTubeEmbed from './YouTubeEmbed'

describe('YouTubeEmbed', () => {
  it('renders an iframe on the nocookie domain with lazy loading and fullscreen', () => {
    const { container } = render(<YouTubeEmbed videoId="dQw4w9WgXcQ" />)
    const iframe = container.querySelector('iframe')

    expect(iframe).not.toBeNull()
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
    )
    expect(iframe).toHaveAttribute('loading', 'lazy')
    expect(iframe).toHaveAttribute('allowFullScreen')
    expect(iframe?.getAttribute('title')).toBeTruthy()
  })

  it('never uses the plain youtube.com embed domain', () => {
    const { container } = render(<YouTubeEmbed videoId="dQw4w9WgXcQ" />)
    const iframe = container.querySelector('iframe')

    expect(iframe?.getAttribute('src')).not.toContain('www.youtube.com/embed')
  })
})

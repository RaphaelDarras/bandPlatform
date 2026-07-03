import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import SpotifyEmbed from './SpotifyEmbed'

describe('SpotifyEmbed', () => {
  it('renders a track iframe with the correct src, height, and lazy loading', () => {
    const { container } = render(<SpotifyEmbed embedType="track" id="0tyZM3OawPGQc0heX67clL" />)
    const iframe = container.querySelector('iframe')

    expect(iframe).not.toBeNull()
    expect(iframe).toHaveAttribute(
      'src',
      'https://open.spotify.com/embed/track/0tyZM3OawPGQc0heX67clL?utm_source=generator',
    )
    expect(iframe).toHaveAttribute('height', '152')
    expect(iframe).toHaveAttribute('loading', 'lazy')
    expect(iframe?.getAttribute('title')).toBeTruthy()
  })

  it('uses height 352 for an album embed', () => {
    const { container } = render(<SpotifyEmbed embedType="album" id="abc123" />)
    const iframe = container.querySelector('iframe')

    expect(iframe).toHaveAttribute(
      'src',
      'https://open.spotify.com/embed/album/abc123?utm_source=generator',
    )
    expect(iframe).toHaveAttribute('height', '352')
  })

  it('uses height 352 for a playlist embed', () => {
    const { container } = render(<SpotifyEmbed embedType="playlist" id="xyz789" />)
    const iframe = container.querySelector('iframe')

    expect(iframe).toHaveAttribute('height', '352')
  })
})

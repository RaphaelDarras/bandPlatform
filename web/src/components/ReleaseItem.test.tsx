import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ReleaseItem from './ReleaseItem'
import type { Release } from '../data/releases'

describe('ReleaseItem — never-both invariant (D-17)', () => {
  it('renders exactly one Spotify iframe and zero YouTube iframes for a spotify release', () => {
    const release: Release = { kind: 'spotify', embedType: 'track', id: 'abc123' }
    const { container } = render(<ReleaseItem release={release} />)

    const iframes = container.querySelectorAll('iframe')
    expect(iframes).toHaveLength(1)
    expect(iframes[0].getAttribute('src')).toContain('open.spotify.com/embed/track/abc123')
    expect(iframes[0].getAttribute('src')).not.toContain('youtube')
  })

  it('renders exactly one YouTube iframe and zero Spotify iframes for a youtube release', () => {
    const release: Release = { kind: 'youtube', videoId: 'xyz789' }
    const { container } = render(<ReleaseItem release={release} />)

    const iframes = container.querySelectorAll('iframe')
    expect(iframes).toHaveLength(1)
    expect(iframes[0].getAttribute('src')).toContain('youtube-nocookie.com/embed/xyz789')
    expect(iframes[0].getAttribute('src')).not.toContain('spotify')
  })

  it('renders no title/date metadata text', () => {
    const release: Release = { kind: 'spotify', embedType: 'track', id: 'abc123' }
    const { container } = render(<ReleaseItem release={release} />)

    // Only the iframe should be present — no heading or paragraph metadata.
    expect(container.querySelector('h1,h2,h3,time')).toBeNull()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Release } from '../data/releases'

const stubReleases: Release[] = [
  { kind: 'spotify', embedType: 'track', id: 'track-1' },
  { kind: 'youtube', videoId: 'video-1' },
  { kind: 'spotify', embedType: 'album', id: 'album-1' },
]

vi.mock('../data/releases', () => ({ releases: stubReleases }))

describe('Discography page', () => {
  it('renders one embed per releases[] entry, in array order (D-21)', async () => {
    const { Component } = await import('./Discography')
    const { container } = render(<Component />)

    expect(screen.getByRole('heading', { name: /discography/i })).toBeInTheDocument()

    const iframes = container.querySelectorAll('iframe')
    expect(iframes).toHaveLength(stubReleases.length)
    expect(iframes[0].getAttribute('src')).toContain('open.spotify.com/embed/track/track-1')
    expect(iframes[1].getAttribute('src')).toContain('youtube-nocookie.com/embed/video-1')
    expect(iframes[2].getAttribute('src')).toContain('open.spotify.com/embed/album/album-1')
  })

  it('renders no title/date metadata text per release (D-20)', async () => {
    const { Component } = await import('./Discography')
    const { container } = render(<Component />)

    expect(container.querySelectorAll('time')).toHaveLength(0)
  })
})

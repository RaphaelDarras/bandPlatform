import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Component as SecretResults } from './SecretResults'

vi.mock('../lib/votes', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchVotes: vi.fn(),
}))
vi.mock('vite-react-ssg', () => ({
  Head: (props: { children?: React.ReactNode }) => <>{props.children}</>,
}))

import { VOTE_CHOICES, fetchVotes } from '../lib/votes'

const tally = { counts: { a: 10, b: 5, c: 0, d: 2 }, total: 17 }

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(fetchVotes).mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('SecretResults', () => {
  it('renders a bottle per choice with fill and counts, plus noindex', async () => {
    vi.mocked(fetchVotes).mockResolvedValue(tally)
    const { container } = render(<SecretResults />)
    await act(async () => {})
    const fills = Array.from(container.querySelectorAll('svg[data-fill]')).map((s) =>
      s.getAttribute('data-fill'),
    )
    expect(fills).toEqual(['1', '0.5', '0', '0.2'])
    expect(screen.getByText('10 votes')).toBeTruthy()
    for (const c of VOTE_CHOICES) expect(screen.getByText(c.description)).toBeTruthy()
    expect(document.querySelector('meta[name="robots"][content="noindex"]')).not.toBeNull()
  })

  it('polls every 5s and stops on unmount', async () => {
    vi.mocked(fetchVotes).mockResolvedValue(tally)
    const { unmount } = render(<SecretResults />)
    await act(async () => {})
    expect(fetchVotes).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(vi.mocked(fetchVotes).mock.calls.length).toBeGreaterThanOrEqual(2)
    unmount()
    const n = vi.mocked(fetchVotes).mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(fetchVotes).toHaveBeenCalledTimes(n)
  })

  it('keeps last good counts on a failed refresh', async () => {
    vi.mocked(fetchVotes).mockResolvedValueOnce(tally).mockRejectedValue(new Error('x'))
    render(<SecretResults />)
    await act(async () => {})
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(screen.getByText('10 votes')).toBeTruthy()
    expect(screen.getByText(/nouvel essai/i)).toBeTruthy()
  })
})

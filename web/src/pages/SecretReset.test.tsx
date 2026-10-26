import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Component as SecretReset } from './SecretReset'

vi.mock('../lib/votes', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resetVotes: vi.fn(),
}))
vi.mock('vite-react-ssg', () => ({
  Head: (props: { children?: React.ReactNode }) => <>{props.children}</>,
}))

import { resetVotes } from '../lib/votes'

const zero = { counts: { a: 0, b: 0, c: 0, d: 0 }, total: 0 }

beforeEach(() => {
  vi.mocked(resetVotes).mockReset()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('SecretReset', () => {
  it('renders the reset button and noindex', () => {
    render(<SecretReset />)
    expect(screen.getByRole('button', { name: /remettre à zéro/i })).toBeTruthy()
    expect(document.querySelector('meta[name="robots"][content="noindex"]')).not.toBeNull()
  })

  it('does nothing when the confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<SecretReset />)
    fireEvent.click(screen.getByRole('button', { name: /remettre à zéro/i }))
    expect(resetVotes).not.toHaveBeenCalled()
  })

  it('resets after confirmation and says so', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(resetVotes).mockResolvedValue(zero)
    render(<SecretReset />)
    fireEvent.click(screen.getByRole('button', { name: /remettre à zéro/i }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/remis à zéro/i))
    expect(resetVotes).toHaveBeenCalledTimes(1)
  })

  it('shows an error when the reset fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(resetVotes).mockRejectedValue(new Error('x'))
    render(<SecretReset />)
    fireEvent.click(screen.getByRole('button', { name: /remettre à zéro/i }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/échoué/i))
  })
})

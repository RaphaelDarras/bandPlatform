import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Component as SecretVote } from './SecretVote'

vi.mock('../lib/votes', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  castVote: vi.fn(),
}))
vi.mock('vite-react-ssg', () => ({
  Head: (props: { children?: React.ReactNode }) => <>{props.children}</>,
}))

import { castVote, VOTE_CHOICES, VOTED_STORAGE_KEY } from '../lib/votes'

beforeEach(() => {
  localStorage.clear()
  vi.mocked(castVote).mockReset()
})

describe('SecretVote', () => {
  it('renders choices, disabled submit, and noindex', () => {
    render(<SecretVote />)
    for (const c of VOTE_CHOICES) expect(screen.getByLabelText(c.label)).toBeTruthy()
    expect((screen.getByRole('button', { name: /voter/i }) as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('meta[name="robots"][content="noindex"]')).not.toBeNull()
  })

  it('submits the vote and shows thank-you', async () => {
    vi.mocked(castVote).mockResolvedValue({ counts: { a: 0, b: 1, c: 0, d: 0 }, total: 1 })
    render(<SecretVote />)
    fireEvent.click(screen.getByLabelText(VOTE_CHOICES[1].label))
    fireEvent.click(screen.getByRole('button', { name: /voter/i }))
    await waitFor(() => expect(screen.getByText(/merci/i)).toBeTruthy())
    expect(castVote).toHaveBeenCalledWith('b')
    expect(localStorage.getItem(VOTED_STORAGE_KEY)).toBeTruthy()
  })

  it('shows an error and keeps the form on failure', async () => {
    vi.mocked(castVote).mockRejectedValue(new Error('x'))
    render(<SecretVote />)
    fireEvent.click(screen.getByLabelText(VOTE_CHOICES[0].label))
    fireEvent.click(screen.getByRole('button', { name: /voter/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('button', { name: /voter/i })).toBeTruthy()
  })

  it('shows the already-voted state from localStorage', async () => {
    localStorage.setItem(VOTED_STORAGE_KEY, '1')
    render(<SecretVote />)
    await waitFor(() => expect(screen.getByText(/merci/i)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /voter/i })).toBeNull()
  })
})

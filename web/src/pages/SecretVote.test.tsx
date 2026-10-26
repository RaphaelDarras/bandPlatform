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

import { castVote, VOTE_CHOICES } from '../lib/votes'

beforeEach(() => {
  vi.mocked(castVote).mockReset()
})

describe('SecretVote', () => {
  it('renders choices, disabled submit, and noindex', () => {
    render(<SecretVote />)
    for (const c of VOTE_CHOICES) {
      expect(screen.getByLabelText(c.label)).toBeTruthy()
      expect(screen.getByText(c.description)).toBeTruthy()
    }
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
  })

  it('shows an error and keeps the form on failure', async () => {
    vi.mocked(castVote).mockRejectedValue(new Error('x'))
    render(<SecretVote />)
    fireEvent.click(screen.getByLabelText(VOTE_CHOICES[0].label))
    fireEvent.click(screen.getByRole('button', { name: /voter/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('button', { name: /voter/i })).toBeTruthy()
  })

  it('lets the user vote again after the thank-you', async () => {
    vi.mocked(castVote).mockResolvedValue({ counts: { a: 1, b: 0, c: 0, d: 0 }, total: 1 })
    render(<SecretVote />)
    fireEvent.click(screen.getByLabelText(VOTE_CHOICES[0].label))
    fireEvent.click(screen.getByRole('button', { name: /^voter$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /revoter/i }))
    const submit = screen.getByRole('button', { name: /^voter$/i }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(VOTE_CHOICES[2].label))
    fireEvent.click(submit)
    await waitFor(() => expect(castVote).toHaveBeenLastCalledWith('c'))
    expect(castVote).toHaveBeenCalledTimes(2)
  })
})

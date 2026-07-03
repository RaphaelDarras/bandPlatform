import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { BitEvent } from '../lib/bandsintown'
import fixture from '../lib/__fixtures__/bandsintown-events.json'

const events = fixture as BitEvent[]

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useLoaderData: vi.fn(),
  }
})

import { useLoaderData } from 'react-router-dom'
import { Component as Concerts } from './Concerts'

describe('Concerts page', () => {
  it('renders the "Upcoming Shows" heading and event rows from loader data', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events })

    render(
      <MemoryRouter>
        <Concerts />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /upcoming shows/i })).toBeInTheDocument()
    expect(screen.getByText(/Le Bikini/)).toBeInTheDocument()
  })

  it('renders the empty state when loader data has no events', () => {
    vi.mocked(useLoaderData).mockReturnValue({ events: [] })

    render(
      <MemoryRouter>
        <Concerts />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /no shows scheduled/i })).toBeInTheDocument()
  })
})

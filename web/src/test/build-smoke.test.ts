import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import Header from '../components/Header'

// Wave 0 build-smoke: the app shell mounts and the three main-nav links
// (Home, Listen, Concerts — D-24) are present in the document.
// Full prerender-output assertions are owned by Plan 04-05.
describe('app shell (build smoke)', () => {
  it('renders the three main-nav links', () => {
    render(createElement(MemoryRouter, null, createElement(Header)))

    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /listen/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /concerts/i })).toBeInTheDocument()
  })

  it('exposes an accessible mobile menu toggle', () => {
    render(createElement(MemoryRouter, null, createElement(Header)))

    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument()
  })
})

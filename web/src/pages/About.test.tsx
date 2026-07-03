import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Component as About } from './About'

describe('About page', () => {
  it('renders the "About" heading and a single bio paragraph', () => {
    const { container } = render(<About />)

    expect(screen.getByRole('heading', { name: /about/i })).toBeInTheDocument()

    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0].textContent?.trim().length).toBeGreaterThan(0)
  })

  it('renders no lineup/member section', () => {
    render(<About />)
    expect(screen.queryByText(/lineup|member/i)).not.toBeInTheDocument()
  })
})

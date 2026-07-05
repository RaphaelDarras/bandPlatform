import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StockBadge from './StockBadge'

// Boundary values per D-15: 0 (out), 1 & 4 (low), 5 & 50 (in stock).
describe('StockBadge — 3-state stock indicator (D-15)', () => {
  it('renders "Out of Stock" in red when stock is 0', () => {
    render(<StockBadge stock={0} />)
    const badge = screen.getByText('Out of Stock')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('text-[#ef4444]')
  })

  it('renders "Low Stock — 1 left" in amber when stock is 1', () => {
    render(<StockBadge stock={1} />)
    const badge = screen.getByText('Low Stock — 1 left')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('text-[#f59e0b]')
  })

  it('renders "Low Stock — 4 left" in amber when stock is 4', () => {
    render(<StockBadge stock={4} />)
    const badge = screen.getByText('Low Stock — 4 left')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('text-[#f59e0b]')
  })

  it('renders "In Stock" in green when stock is 5', () => {
    render(<StockBadge stock={5} />)
    const badge = screen.getByText('In Stock')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('text-[#22c55e]')
  })

  it('renders "In Stock" in green when stock is 50', () => {
    render(<StockBadge stock={50} />)
    const badge = screen.getByText('In Stock')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('text-[#22c55e]')
  })
})

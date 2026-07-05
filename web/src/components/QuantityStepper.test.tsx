import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuantityStepper from './QuantityStepper'

// Behavior per D-18 accessible +/- control: bounded 1..max via props, no
// internal state, disabled boundaries block onChange entirely.
describe('QuantityStepper — accessible +/- control (D-18)', () => {
  it('calls onChange(value+1) when + is clicked and value < max', () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={2} max={5} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('calls onChange(value-1) when − is clicked and value > 1', () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={2} max={5} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Decrease quantity'))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('disables + and does not call onChange when value === max', () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={5} max={5} onChange={onChange} />)
    const increase = screen.getByLabelText('Increase quantity')
    expect(increase).toBeDisabled()
    fireEvent.click(increase)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables − and does not call onChange when value === 1', () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={1} max={5} onChange={onChange} />)
    const decrease = screen.getByLabelText('Decrease quantity')
    expect(decrease).toBeDisabled()
    fireEvent.click(decrease)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables both buttons when disabled prop is true', () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={2} max={5} onChange={onChange} disabled />)
    expect(screen.getByLabelText('Decrease quantity')).toBeDisabled()
    expect(screen.getByLabelText('Increase quantity')).toBeDisabled()
  })

  it('exposes aria-label "Decrease quantity" and "Increase quantity"', () => {
    render(<QuantityStepper value={2} max={5} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Decrease quantity')).toBeInTheDocument()
    expect(screen.getByLabelText('Increase quantity')).toBeInTheDocument()
  })
})

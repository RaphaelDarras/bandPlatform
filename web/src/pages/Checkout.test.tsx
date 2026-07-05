import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useCartStore, type CartLine } from '../lib/cartStore'
import { Component as Checkout } from './Checkout'

const shirtLine: CartLine = {
  productId: 'p1',
  variantSku: 'TS-M-BLK',
  quantity: 2,
  name: 'Tour Shirt',
  variantLabel: 'M / Black',
  unitPrice: 25,
  image: 'https://example.com/shirt.jpg',
}

beforeEach(() => {
  useCartStore.setState({ lines: [], hasHydrated: false })
})

describe('Checkout page', () => {
  it('renders all guest-checkout fields', () => {
    render(<Checkout />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/address line 1/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/address line 2/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^country$/i)).toBeInTheDocument()
  })

  it('shows an inline error when email is left empty on blur', () => {
    render(<Checkout />)

    const email = screen.getByLabelText(/email/i)
    fireEvent.focus(email)
    fireEvent.blur(email)

    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
  })

  it('shows an inline error when email format is invalid', () => {
    render(<Checkout />)

    const email = screen.getByLabelText(/email/i)
    fireEvent.change(email, { target: { value: 'not-an-email' } })
    fireEvent.blur(email)

    expect(screen.getByText(/valid email address/i)).toBeInTheDocument()
  })

  it('clears the email error once a valid address is entered', () => {
    render(<Checkout />)

    const email = screen.getByLabelText(/email/i)
    fireEvent.change(email, { target: { value: 'not-an-email' } })
    fireEvent.blur(email)
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument()

    fireEvent.change(email, { target: { value: 'fan@example.com' } })
    expect(screen.queryByText(/valid email address/i)).not.toBeInTheDocument()
  })

  it('shows an inline error when a required shipping field is left empty on blur', () => {
    render(<Checkout />)

    const city = screen.getByLabelText(/city/i)
    fireEvent.focus(city)
    fireEvent.blur(city)

    expect(screen.getByText(/city is required/i)).toBeInTheDocument()
  })

  it('renders Place Order permanently disabled with the coming-soon note', () => {
    render(<Checkout />)

    const button = screen.getByRole('button', { name: /place order/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('type', 'button')
    expect(button.className).toMatch(/bg-white\/20/)
    expect(button.className).toMatch(/text-white\/40/)
    expect(button.className).toMatch(/cursor-not-allowed/)
    expect(screen.getByText(/online payment is coming soon/i)).toBeInTheDocument()
  })

  it('shows the cart subtotal in the order summary', () => {
    useCartStore.setState({ lines: [shirtLine], hasHydrated: true })

    render(<Checkout />)

    expect(screen.getByText(/subtotal.*50 CAD/i)).toBeInTheDocument()
  })

  it('the country field is free-text with a maxLength bound and no select exists', () => {
    render(<Checkout />)

    const country = screen.getByLabelText(/^country$/i)
    expect(country.tagName).toBe('INPUT')
    expect(country).toHaveAttribute('maxLength')
    expect(document.querySelector('select')).toBeNull()
  })

  it('has no form onSubmit / API submit path', () => {
    render(<Checkout />)

    const form = document.querySelector('form') as HTMLFormElement
    expect(form).not.toHaveAttribute('onSubmit')
    const button = screen.getByRole('button', { name: /place order/i })
    expect(button).toHaveAttribute('type', 'button')
  })
})

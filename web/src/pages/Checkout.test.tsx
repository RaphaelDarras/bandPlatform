import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useCartStore, type CartLine } from '../lib/cartStore'
import { Component as Checkout } from './Checkout'

vi.mock('../lib/orders', () => ({
  createOrder: vi.fn(),
}))

import { createOrder } from '../lib/orders'

const shirtLine: CartLine = {
  productId: 'p1',
  variantSku: 'TS-M-BLK',
  quantity: 2,
  name: 'Tour Shirt',
  variantLabel: 'M / Black',
  unitPrice: 25,
  image: 'https://example.com/shirt.jpg',
}

const originalLocation = window.location

beforeEach(() => {
  useCartStore.setState({ lines: [], hasHydrated: false })
  vi.mocked(createOrder).mockReset()
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: { ...originalLocation, href: '' },
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: originalLocation,
  })
})

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'fan@example.com' } })
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Fan Name' } })
  fireEvent.change(screen.getByLabelText(/address line 1/i), {
    target: { value: '1 Rue Example' },
  })
  fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Paris' } })
  fireEvent.change(screen.getByLabelText(/postal code/i), { target: { value: '75001' } })
  fireEvent.change(screen.getByLabelText(/^country$/i), { target: { value: 'France' } })
}

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

  it('renders a Stripe-card vs PayPal payment method selector, defaulting to card', () => {
    render(<Checkout />)

    const cardOption = screen.getByLabelText(/card/i)
    const paypalOption = screen.getByLabelText(/paypal/i)
    expect(cardOption).toBeInTheDocument()
    expect(paypalOption).toBeInTheDocument()
    expect(cardOption).toBeChecked()
    expect(paypalOption).not.toBeChecked()

    fireEvent.click(paypalOption)
    expect(paypalOption).toBeChecked()
    expect(cardOption).not.toBeChecked()
  })

  it('disables Place Order until all required fields are valid, then enables it', () => {
    render(<Checkout />)

    const button = screen.getByRole('button', { name: /place order/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('type', 'submit')

    fillValidForm()

    expect(button).toBeEnabled()
  })

  it('shows the cart subtotal in € in the order summary', () => {
    useCartStore.setState({ lines: [shirtLine], hasHydrated: true })

    render(<Checkout />)

    expect(screen.getByText(/subtotal.*€?50/i)).toBeInTheDocument()
  })

  it('the country field is free-text with a maxLength bound and no select exists', () => {
    render(<Checkout />)

    const country = screen.getByLabelText(/^country$/i)
    expect(country.tagName).toBe('INPUT')
    expect(country).toHaveAttribute('maxLength')
    expect(document.querySelector('select')).toBeNull()
  })

  it('submitting a valid form calls createOrder with the cart+form payload and redirects to the returned URL', async () => {
    useCartStore.setState({ lines: [shirtLine], hasHydrated: true })
    vi.mocked(createOrder).mockResolvedValue({
      orderNumber: 'HRK-ABC123',
      redirectUrl: 'https://checkout.example.com/session/123',
    })

    render(<Checkout />)
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: /place order/i }))

    await waitFor(() => expect(window.location.href).toBe('https://checkout.example.com/session/123'))

    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: 'fan@example.com',
        customerName: 'Fan Name',
        items: [{ productId: 'p1', variantSku: 'TS-M-BLK', quantity: 2 }],
        shippingAddress: expect.objectContaining({
          addressLine1: '1 Rue Example',
          city: 'Paris',
          postalCode: '75001',
          country: 'France',
        }),
        paymentMethod: 'stripe',
      }),
    )
  })

  it('sends paymentMethod: paypal when the PayPal option is selected', async () => {
    useCartStore.setState({ lines: [shirtLine], hasHydrated: true })
    vi.mocked(createOrder).mockResolvedValue({
      orderNumber: 'HRK-ABC123',
      redirectUrl: 'https://paypal.example.com/checkout/123',
    })

    render(<Checkout />)
    fillValidForm()
    fireEvent.click(screen.getByLabelText(/paypal/i))

    fireEvent.click(screen.getByRole('button', { name: /place order/i }))

    await waitFor(() =>
      expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: 'paypal' })),
    )
  })

  it('shows an inline error and does not redirect when createOrder rejects', async () => {
    useCartStore.setState({ lines: [shirtLine], hasHydrated: true })
    vi.mocked(createOrder).mockRejectedValue(new Error('Failed to create order (500)'))

    render(<Checkout />)
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: /place order/i }))

    await waitFor(() => expect(screen.getByText(/failed to create order/i)).toBeInTheDocument())
    expect(window.location.href).toBe('')
  })
})

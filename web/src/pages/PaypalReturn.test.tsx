import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// WR-06 regression coverage: PaypalReturn must inspect the resolved capture
// status rather than treating any non-throwing capturePaypalOrder call as
// success (PayPal documents PENDING as a possible non-terminal outcome).

vi.mock('../lib/orders', () => ({
  capturePaypalOrder: vi.fn(),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

import { capturePaypalOrder } from '../lib/orders'
import { Component as PaypalReturn } from './PaypalReturn'

function renderReturn(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/checkout/paypal-return${search}`]}>
      <PaypalReturn />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  navigateMock.mockClear()
  vi.mocked(capturePaypalOrder).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PaypalReturn page', () => {
  it('redirects to /checkout/cancel immediately when no token is present', () => {
    renderReturn('?order=HRK-ABC123')

    expect(navigateMock).toHaveBeenCalledWith('/checkout/cancel', { replace: true })
    expect(capturePaypalOrder).not.toHaveBeenCalled()
  })

  it('redirects to /checkout/success when the capture status is COMPLETED', async () => {
    vi.mocked(capturePaypalOrder).mockResolvedValue({ status: 'COMPLETED' })

    renderReturn('?token=PAYPAL-TOKEN-1&order=HRK-ABC123')

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/checkout/success?order=HRK-ABC123', { replace: true }),
    )
  })

  it('redirects to /checkout/cancel (not success) when the capture status is PENDING (WR-06)', async () => {
    vi.mocked(capturePaypalOrder).mockResolvedValue({ status: 'PENDING' })

    renderReturn('?token=PAYPAL-TOKEN-1&order=HRK-ABC123')

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/checkout/cancel', { replace: true }))
    expect(navigateMock).not.toHaveBeenCalledWith(expect.stringContaining('/checkout/success'), expect.anything())
  })

  it('redirects to /checkout/cancel when the capture call rejects', async () => {
    vi.mocked(capturePaypalOrder).mockRejectedValue(new Error('capture failed'))

    renderReturn('?token=PAYPAL-TOKEN-1&order=HRK-ABC123')

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/checkout/cancel', { replace: true }))
  })

  it('renders the finalizing-payment interstitial copy', () => {
    vi.mocked(capturePaypalOrder).mockResolvedValue({ status: 'COMPLETED' })

    renderReturn('?token=PAYPAL-TOKEN-1&order=HRK-ABC123')

    expect(screen.getByText(/finalizing your payment/i)).toBeInTheDocument()
  })
})

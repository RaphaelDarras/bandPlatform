import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CreateProductPanel } from './CreateProductPanel'

// End-to-end coverage for the create-product panel (INV-05). The real
// AuthExpiredError class is preserved via importOriginal so `instanceof`
// checks in the component keep working while createProduct is a spy.
vi.mock('../lib/inventory', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createProduct: vi.fn(),
}))

import { createProduct, AuthExpiredError } from '../lib/inventory'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function defaultProps() {
  return {
    token: 'test-token',
    existingSkus: [] as string[],
    onCreated: vi.fn(),
    onCancel: vi.fn(),
    onAuthExpired: vi.fn(),
  }
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'T-Shirt' } })
  fireEvent.change(screen.getByLabelText(/base price/i), { target: { value: '25' } })
  fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'M' } })
  fireEvent.change(screen.getByLabelText('Opening stock for M / —'), { target: { value: '7' } })
}

beforeEach(() => {
  vi.mocked(createProduct).mockReset()
})

describe('CreateProductPanel', () => {
  it('disables Create product on first render and enables it once name, price and a variant row exist', () => {
    render(<CreateProductPanel {...defaultProps()} />)

    const submitButton = screen.getByRole('button', { name: /create product/i })
    expect(submitButton).toBeDisabled()

    fillValidForm()

    expect(submitButton).toBeEnabled()
  })

  it('submits with a trimmed name, a numeric basePrice, and the opening stock from the generator (D-11)', () => {
    vi.mocked(createProduct).mockResolvedValue({})
    render(<CreateProductPanel {...defaultProps()} />)

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: '  T-Shirt  ' } })
    fireEvent.change(screen.getByLabelText(/base price/i), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'M' } })
    fireEvent.change(screen.getByLabelText('Opening stock for M / —'), { target: { value: '7' } })

    fireEvent.click(screen.getByRole('button', { name: /create product/i }))

    expect(createProduct).toHaveBeenCalledTimes(1)
    const [, payload] = vi.mocked(createProduct).mock.calls[0]
    expect(payload.name).toBe('T-Shirt')
    expect(typeof payload.basePrice).toBe('number')
    expect(payload.basePrice).toBe(25)
    expect(payload.variants).toHaveLength(1)
    expect(payload.variants[0]).toEqual({
      sku: 'TSHIRT-M',
      size: 'M',
      color: undefined,
      stock: 7,
      priceAdjustment: 0,
    })
  })

  it('sends a payload with no description and no images key', () => {
    vi.mocked(createProduct).mockResolvedValue({})
    render(<CreateProductPanel {...defaultProps()} />)

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /create product/i }))

    const [, payload] = vi.mocked(createProduct).mock.calls[0]
    expect(payload).not.toHaveProperty('description')
    expect(payload).not.toHaveProperty('images')
  })

  it('on resolve, calls onCreated once and renders the success line', async () => {
    vi.mocked(createProduct).mockResolvedValue({})
    const onCreated = vi.fn()
    render(<CreateProductPanel {...defaultProps()} onCreated={onCreated} />)

    fillValidForm()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create product/i }))
    })

    expect(onCreated).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Product created.')).toBeInTheDocument()
  })

  it('on a 409 SKU-clash rejection, shows the server message verbatim, keeps the panel open, and preserves typed input', async () => {
    vi.mocked(createProduct).mockRejectedValue(new Error('SKU already in use: TSHIRT-M-BLK'))
    const onCreated = vi.fn()
    render(<CreateProductPanel {...defaultProps()} onCreated={onCreated} />)

    fillValidForm()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create product/i }))
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('SKU already in use: TSHIRT-M-BLK')
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('T-Shirt')
  })

  it('on an expired session, calls onAuthExpired once and renders no alert copy', async () => {
    vi.mocked(createProduct).mockRejectedValue(new AuthExpiredError('Session expired'))
    const onAuthExpired = vi.fn()
    render(<CreateProductPanel {...defaultProps()} onAuthExpired={onAuthExpired} />)

    fillValidForm()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create product/i }))
    })

    expect(onAuthExpired).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows "Creating…" and disables the submit button while the request is pending', async () => {
    const deferred = createDeferred<unknown>()
    vi.mocked(createProduct).mockReturnValue(deferred.promise as ReturnType<typeof createProduct>)
    render(<CreateProductPanel {...defaultProps()} />)

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /create product/i }))

    const pendingButton = screen.getByRole('button', { name: /creating/i })
    expect(pendingButton).toBeDisabled()

    await act(async () => {
      deferred.resolve({})
      await deferred.promise
    })
  })

  it('has no field or control whose accessible name matches description, image, or price adjustment (D-10/D-12/D-20)', () => {
    render(<CreateProductPanel {...defaultProps()} />)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'M' } })

    expect(screen.queryByLabelText(/description/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/image/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/price adjustment/i)).not.toBeInTheDocument()
  })
})

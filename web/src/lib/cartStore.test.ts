import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore, type CartLine } from './cartStore'

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 'p1',
    variantSku: 'sku-m-black',
    quantity: 1,
    name: 'Tour Tee',
    variantLabel: 'M / Black',
    unitPrice: 25,
    image: '/images/tee.jpg',
    ...overrides,
  }
}

describe('cartStore', () => {
  beforeEach(() => {
    // Reset to the store's initial shape between tests (no persist/rehydrate
    // call — mirrors production: hasHydrated stays false unless a test sets it).
    useCartStore.setState({ lines: [], hasHydrated: false })
  })

  it('hasHydrated starts false and importing the module does not read localStorage', () => {
    expect(useCartStore.getState().hasHydrated).toBe(false)
  })

  it('setHasHydrated flips the flag', () => {
    useCartStore.getState().setHasHydrated(true)
    expect(useCartStore.getState().hasHydrated).toBe(true)
  })

  it('addLine appends a new productId+variantSku as a new line', () => {
    useCartStore.getState().addLine(line({ quantity: 2 }), 10)
    expect(useCartStore.getState().lines).toHaveLength(1)
    expect(useCartStore.getState().lines[0].quantity).toBe(2)
  })

  it('addLine merges an existing productId+variantSku and caps at stockCap (D-13)', () => {
    useCartStore.getState().addLine(line({ quantity: 3 }), 10)
    useCartStore.getState().addLine(line({ quantity: 5 }), 4)
    expect(useCartStore.getState().lines).toHaveLength(1)
    expect(useCartStore.getState().lines[0].quantity).toBe(4)
  })

  it('addLine treats a different variantSku as a distinct line', () => {
    useCartStore.getState().addLine(line({ variantSku: 'sku-m-black' }), 10)
    useCartStore.getState().addLine(line({ variantSku: 'sku-l-black' }), 10)
    expect(useCartStore.getState().lines).toHaveLength(2)
  })

  it('setQuantity replaces a matched line quantity', () => {
    useCartStore.getState().addLine(line({ quantity: 1 }), 10)
    useCartStore.getState().setQuantity('p1', 'sku-m-black', 7)
    expect(useCartStore.getState().lines[0].quantity).toBe(7)
  })

  it('removeLine drops the matched line', () => {
    useCartStore.getState().addLine(line(), 10)
    useCartStore.getState().removeLine('p1', 'sku-m-black')
    expect(useCartStore.getState().lines).toHaveLength(0)
  })

  it('clearCart empties lines', () => {
    useCartStore.getState().addLine(line(), 10)
    useCartStore.getState().addLine(line({ variantSku: 'sku-l-black' }), 10)
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().lines).toHaveLength(0)
  })
})

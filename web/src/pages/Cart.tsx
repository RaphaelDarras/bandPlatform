import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProducts } from '../lib/products'
import { useCartStore, type CartLine } from '../lib/cartStore'
import QuantityStepper from '../components/QuantityStepper'
import { formatPrice } from '../lib/format'

// Cart page (SHOP-02/SHOP-13, `/cart`). The reconciliation + review screen
// before checkout (RESEARCH.md Pattern 5) — the one point where cart-vs-
// live-stock staleness is caught. On mount (after hasHydrated), re-fetches
// the live catalog via fetchProducts() and flags any line whose quantity
// exceeds current stock, or whose product/variant is missing/zero-stock
// (Open Q3 — treat "not found" the same as zero stock). Flagged lines are
// NEVER auto-adjusted (D-14) -- the effect below only writes to local
// component state (setRevalidated), never calls useCartStore.setQuantity.
// Empty-cart state (D-26) matches ConcertList.tsx's plain-text empty-state
// shape (heading + body + CTA).

type StockInfo = { currentStock: number; flagged: boolean }

function lineKey(line: Pick<CartLine, 'productId' | 'variantSku'>): string {
  return `${line.productId}::${line.variantSku}`
}

export function Component() {
  const lines = useCartStore((s) => s.lines)
  const hasHydrated = useCartStore((s) => s.hasHydrated)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const removeLine = useCartStore((s) => s.removeLine)

  const [revalidated, setRevalidated] = useState<Record<string, StockInfo>>({})

  useEffect(() => {
    if (!hasHydrated) return

    fetchProducts()
      .then((products) => {
        const next: Record<string, StockInfo> = {}
        for (const line of lines) {
          const product = products.find((p) => p.id === line.productId)
          const variant = product?.variants.find((v) => v.sku === line.variantSku)
          // Product/variant missing from the active catalog -> treat as 0
          // stock for flagging purposes (Open Q3).
          const currentStock = variant?.stock ?? 0
          next[lineKey(line)] = {
            currentStock,
            flagged: currentStock === 0 || line.quantity > currentStock,
          }
        }
        setRevalidated(next)
      })
      .catch(() => {
        // Best-effort revalidation: if the live-stock check itself fails
        // (e.g. API unreachable), show lines un-flagged rather than
        // blocking the whole page -- D-14 is about not silently
        // *adjusting* quantities, not about hiding the cart on network error.
      })
    // Re-run whenever the hydrated line set changes (add/remove/update).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, lines])

  if (hasHydrated && lines.length === 0) {
    return (
      <section>
        <h1 className="font-display text-3xl uppercase text-white">Cart</h1>
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <h2 className="font-display text-3xl uppercase text-white">Your cart is empty</h2>
          <p className="font-sans text-base text-white/75">
            Looks like you haven't added anything yet.
          </p>
          <Link
            to="/shop"
            className="mt-4 inline-block bg-[var(--color-accent)] px-6 py-3 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-black"
          >
            Browse Shop
          </Link>
        </div>
      </section>
    )
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  const anyFlagged = lines.some((l) => revalidated[lineKey(l)]?.flagged)

  return (
    <section>
      <h1 className="font-display text-3xl uppercase text-white">Cart</h1>

      <div className="mt-4 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
        <ul className="flex flex-col gap-3">
          {lines.map((line) => {
            const info = revalidated[lineKey(line)]
            const flagged = info?.flagged ?? false
            // Before revalidation resolves, assume the persisted quantity
            // is available -- avoid flashing a false flag while loading.
            const currentStock = info?.currentStock ?? line.quantity

            return (
              <li
                key={lineKey(line)}
                className={`border p-4 bg-[var(--color-surface)] ${
                  flagged ? 'border-[#ef4444]' : 'border-[var(--color-hairline)]'
                }`}
              >
                <div className="flex gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden bg-black/20">
                    {line.image ? (
                      <img
                        src={line.image}
                        alt={line.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src="/images/HURAKAN_SLAM_ICON_inverted.png"
                        alt=""
                        className="w-2/5 opacity-40"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white">
                      {line.name}
                    </p>
                    <p className="mt-1 font-sans text-sm text-white/75">{line.variantLabel}</p>
                    <p className="mt-1 font-sans text-sm text-white/75">
                      {formatPrice(line.unitPrice)}
                    </p>

                    {flagged ? (
                      <div className="mt-2">
                        <p className="font-sans text-sm text-[#ef4444]">
                          No longer available in this quantity
                        </p>
                        <div className="mt-2 flex gap-4">
                          {currentStock > 0 && (
                            <button
                              type="button"
                              aria-label={`Update quantity for ${line.name}`}
                              onClick={() =>
                                setQuantity(line.productId, line.variantSku, currentStock)
                              }
                              className="font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white underline"
                            >
                              Update
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Remove ${line.name} from cart`}
                            onClick={() => removeLine(line.productId, line.variantSku)}
                            className="font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-4">
                        <QuantityStepper
                          value={line.quantity}
                          max={currentStock}
                          onChange={(n) => setQuantity(line.productId, line.variantSku, n)}
                        />
                        <p className="font-sans text-sm font-semibold text-white">
                          {formatPrice(line.unitPrice * line.quantity)}
                        </p>
                        <button
                          type="button"
                          aria-label={`Remove ${line.name} from cart`}
                          onClick={() => removeLine(line.productId, line.variantSku)}
                          className="flex h-11 w-11 items-center justify-center text-white"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="mt-8 border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4 lg:mt-0 lg:self-start">
          <h2 className="font-display text-3xl uppercase text-white">Order Summary</h2>
          <p className="mt-2 font-sans text-base text-white/75">Subtotal: {formatPrice(subtotal)}</p>

          {anyFlagged ? (
            <>
              <button
                type="button"
                disabled
                className="mt-4 w-full bg-white/20 px-6 py-3 text-center font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white/40 cursor-not-allowed"
              >
                Checkout
              </button>
              <p className="mt-2 font-sans text-sm text-white/50">
                Resolve the flagged items above to continue.
              </p>
            </>
          ) : (
            <Link
              to="/checkout"
              className="mt-4 block w-full bg-[var(--color-accent)] px-6 py-3 text-center font-sans text-sm font-semibold uppercase tracking-[0.06em] text-black"
            >
              Checkout
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

export default Component

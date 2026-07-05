import { useEffect, useState } from 'react'
import type { Product } from '@bandplatform/shared'
import { fetchProducts } from '../lib/products'
import CatalogGrid from '../components/CatalogGrid'

// Shop catalog page (SHOP-01). Live client-side fetch of GET /api/products
// (D-05/D-06 — stock must stay live, never baked into static HTML at build
// time) rendered via CatalogGrid, mirroring how Concerts.tsx delegates to
// ConcertList. No loader export in this file — the fetch runs only in the
// browser, triggered from a useEffect on mount (RESEARCH.md Pattern 1).
//
// D-25 — manual product-creation path (no seed script / admin UI this
// phase). Products are created via an authenticated POST /api/products
// (the same admin bearer token used to log into /stock). Request body
// shape (see api/routes/products.js for the full validation contract):
//   {
//     "name": "Tour Shirt",
//     "basePrice": 25,
//     "images": ["https://.../shirt.jpg"],
//     "variants": [
//       { "sku": "TS-M-BLK", "size": "M", "color": "Black", "stock": 20, "priceAdjustment": 0 }
//     ]
//   }
// This is deliberately NOT built as a UI or seed script this phase (D-25) —
// see the plan SUMMARY for the full step-by-step procedure.

const COLD_START_DELAY_MS = 5000

export function Component() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState('')
  const [showColdStartNote, setShowColdStartNote] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setError('')
    setProducts(null)
    setShowColdStartNote(false)

    fetchProducts()
      .then(setProducts)
      .catch(() => setError('Failed to load products'))
    // attempt is bumped by the Retry button to re-trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  useEffect(() => {
    if (products !== null || error) return
    const timer = setTimeout(() => setShowColdStartNote(true), COLD_START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [products, error])

  if (error) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h2 className="font-display text-3xl uppercase text-white">Couldn't load the shop</h2>
        <p className="font-sans text-base text-white/75">
          The store may be waking up or having trouble connecting.
        </p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="border border-[var(--color-accent)] px-4 py-2 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white hover:bg-[var(--color-accent)] hover:text-black"
        >
          Retry
        </button>
      </section>
    )
  }

  return (
    <section>
      <h1 className="font-display text-3xl uppercase text-white">Shop</h1>
      {products === null ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="border border-[var(--color-hairline)] bg-[var(--color-surface)]"
              >
                <div className="aspect-square animate-pulse bg-white/10" />
                <div className="flex flex-col gap-2 p-4">
                  <div className="h-3 w-3/4 animate-pulse bg-white/10" />
                  <div className="h-3 w-1/2 animate-pulse bg-white/10" />
                </div>
              </div>
            ))}
          </div>
          {showColdStartNote && (
            <p className="mt-4 text-center font-sans text-sm text-white/50">
              This can take up to a minute the first time — hang tight.
            </p>
          )}
        </>
      ) : (
        <CatalogGrid products={products} />
      )}
    </section>
  )
}

export default Component

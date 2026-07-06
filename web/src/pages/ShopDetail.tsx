import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Product, Variant } from '@bandplatform/shared'
import { fetchProduct } from '../lib/products'
import { useCartStore } from '../lib/cartStore'
import StockBadge from '../components/StockBadge'
import QuantityStepper from '../components/QuantityStepper'

// Product detail page (SHOP-08/SHOP-13, `/shop/:id`). Live client-side fetch
// of a single product by :id (D-05/D-06) — this file exports NO loader, so
// the route is excluded from vite-react-ssg's prerender pass by default
// (RESEARCH.md Pattern 2); stock must never be baked into static HTML.
// Composes the Plan 04 leaf controls (StockBadge, QuantityStepper) and the
// Plan 05 cart store (useCartStore.addLine) into the core buy-intent screen:
// gallery, variant selection, per-variant stock, capped quantity, adjusted
// price, add-to-cart.

// Joins whichever size/color axes exist on a variant — never assume both
// are present, e.g. "M / Black", "M", or "Black" (UI-SPEC §2).
function variantLabel(variant: Variant): string {
  return [variant.size, variant.color].filter(Boolean).join(' / ')
}

export function Component() {
  const { id } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [selectedSku, setSelectedSku] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    setError('')
    setProduct(null)
    setSelectedSku(null)
    setQuantity(1)
    setActiveImage(0)

    if (!id) {
      setError('Product not found')
      return
    }

    fetchProduct(id)
      .then(setProduct)
      .catch(() => setError('Failed to load product'))
    // attempt is bumped by the Retry button to re-trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt])

  const selectedVariant = product?.variants.find((v) => v.sku === selectedSku) ?? null
  const canAdd = !!selectedVariant && selectedVariant.stock > 0

  function handleAddToCart() {
    if (!product || !selectedVariant || selectedVariant.stock === 0) return
    useCartStore.getState().addLine(
      {
        productId: product.id,
        variantSku: selectedVariant.sku,
        quantity,
        name: product.name,
        variantLabel: variantLabel(selectedVariant),
        unitPrice: product.basePrice + selectedVariant.priceAdjustment,
        image: product.images[0] ?? '',
      },
      selectedVariant.stock, // D-13 — cap merged quantity at live stock
    )
    setQuantity(1)
  }

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

  if (!product) {
    return (
      <section>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="aspect-square animate-pulse bg-white/10" />
          <div className="flex flex-col gap-3">
            <div className="h-4 w-1/2 animate-pulse bg-white/10" />
            <div className="h-6 w-1/3 animate-pulse bg-white/10" />
            <div className="h-10 w-full animate-pulse bg-white/10" />
            <div className="h-11 w-40 animate-pulse bg-white/10" />
          </div>
        </div>
      </section>
    )
  }

  const price = product.basePrice + (selectedVariant?.priceAdjustment ?? 0) // D-23
  const primaryImage = product.images[activeImage]

  return (
    <section>
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Gallery (D-22) */}
        <div>
          <div className="flex aspect-square items-center justify-center overflow-hidden bg-[var(--color-surface)]">
            {/* Guard on primaryImage truthiness, NOT images.length (Pitfall 4) —
                an images: [''] entry still needs the placeholder, not a
                broken <img src=""> element. */}
            {primaryImage ? (
              <img src={primaryImage} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <img
                src="/images/HURAKAN_SLAM_ICON_inverted.png"
                alt=""
                className="w-2/5 opacity-40"
              />
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-2 flex gap-2">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`View image ${i + 1}`}
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-16 overflow-hidden border ${
                    i === activeImage
                      ? 'border-[var(--color-accent)]'
                      : 'border-[var(--color-hairline)]'
                  }`}
                >
                  {img ? (
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <img
                      src="/images/HURAKAN_SLAM_ICON_inverted.png"
                      alt=""
                      className="h-full w-full opacity-40"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="font-display text-3xl uppercase text-white">{product.name}</h1>
          {product.description && (
            <p className="mt-2 font-sans text-base text-white/75">{product.description}</p>
          )}

          {/* Price in EUR (D-01, resolves D-23) */}
          <p className="mt-4 font-sans text-lg font-semibold text-white">€{price}</p>

          {/* Variant selector (D-16/D-18) */}
          <div className="mt-4 flex flex-wrap gap-2">
            {product.variants.map((variant) => {
              const isSelected = variant.sku === selectedSku
              const outOfStock = variant.stock === 0
              return (
                <button
                  key={variant.sku}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => {
                    setSelectedSku(variant.sku)
                    setQuantity(1)
                  }}
                  className={`border px-4 py-2 font-sans text-sm font-semibold uppercase tracking-[0.06em] ${
                    outOfStock
                      ? 'border-[var(--color-hairline)] text-white opacity-40 cursor-not-allowed'
                      : isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-black'
                        : 'border-[var(--color-hairline)] text-white'
                  }`}
                >
                  {variantLabel(variant)}
                </button>
              )
            })}
          </div>

          {/* Stock badge — only shown after a variant is selected (D-17) */}
          {selectedVariant && (
            <div className="mt-2">
              <StockBadge stock={selectedVariant.stock} />
            </div>
          )}

          {/* Quantity — capped at selected variant's stock, disabled until selected (D-18) */}
          <div className="mt-4">
            <QuantityStepper
              value={quantity}
              max={selectedVariant?.stock ?? 1}
              onChange={setQuantity}
              disabled={!selectedVariant}
            />
          </div>

          {/* Add to cart — disabled until an in-stock variant is selected */}
          <button
            type="button"
            disabled={!canAdd}
            onClick={handleAddToCart}
            className={`mt-6 w-full px-6 py-3 font-sans text-sm font-semibold uppercase tracking-[0.06em] lg:w-auto ${
              canAdd
                ? 'bg-[var(--color-accent)] text-black'
                : 'bg-white/20 text-white/40 cursor-not-allowed'
            }`}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </section>
  )
}

export default Component

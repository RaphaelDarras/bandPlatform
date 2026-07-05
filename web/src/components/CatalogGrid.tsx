import { Link } from 'react-router-dom'
import type { Product } from '@bandplatform/shared'

// Catalog grid (SHOP-01/SHOP-07, D-19 flat grid, no category filter). Each
// card is a single Link click-target to the product detail page, mirroring
// ConcertList.tsx's bordered-surface card convention. No stock badge on
// cards (D-17 — stock is shown per-variant on the detail page only).
export default function CatalogGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <section>
        <h2 className="font-display text-3xl uppercase text-white">No products yet</h2>
        <p className="mt-2 font-sans text-base text-white/75">
          Merch is on its way — check back soon.
        </p>
      </section>
    )
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <Link
          key={product.id}
          to={`/shop/${product.id}`}
          className="border border-[var(--color-hairline)] bg-[var(--color-surface)]"
        >
          <div className="flex aspect-square items-center justify-center overflow-hidden bg-[var(--color-surface)]">
            {/* Guard on images[0] truthiness, NOT images.length (Pitfall 4) —
                an images: [''] array still needs the placeholder, not a
                broken <img src=""> element. */}
            {product.images[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
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
          <div className="p-4">
            <p className="font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white">
              {product.name}
            </p>
            {/* D-23 price format */}
            <p className="mt-1 font-sans text-sm text-white/75">${product.basePrice} CAD</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

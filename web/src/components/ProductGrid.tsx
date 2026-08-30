import type { ShopProduct } from '../lib/shopify'

// Product cards. Every card is a deep link to that product's own detail page
// on the Shopify storefront — never the store root.
//
// Hard-edged (zero radius). Hover scales the artwork inside its clipped frame
// and takes the border to gold; no lift, no shadow.
//
// The grid itself carries NO background. It previously used gap-px over a
// hairline fill to fake 1px separators, but an incomplete last row left the
// empty trailing cells showing that fill as a visible block of the wrong
// colour. Each card carries its own border instead, so the grid looks
// identical at any item count.
export default function ProductGrid({ products }: { products: ShopProduct[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.handle}>
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card-hover group flex h-full flex-col border border-[var(--color-hairline)] bg-[var(--color-bg)]"
          >
            <div className="relative aspect-square overflow-hidden bg-[var(--color-bg)]">
              {p.image && (
                <img
                  src={p.image}
                  alt={p.label}
                  loading="lazy"
                  className="card-zoom h-full w-full object-cover"
                />
              )}
              {!p.available && (
                <span className="type-label absolute left-0 top-0 bg-[var(--color-bg)] px-3 py-1.5 text-[var(--color-ink-dim)]">
                  Sold out
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-between gap-3 p-4">
              <p className="type-h3 text-[var(--color-ink)]">{p.label}</p>
              <p className="type-label tabular-nums text-[var(--color-accent)]">
                {p.available ? p.price : 'Unavailable'}
              </p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  )
}

import type { ShopProduct } from '../lib/shopify'

// Product cards. Every card is a deep link to that product's own detail page
// on the Shopify storefront — never the store root.
//
// Hard-edged per the reference site (zero radius). Hover scales the artwork
// inside its clipped frame and takes the border to ivory; no lift, no shadow.
export default function ProductGrid({ products }: { products: ShopProduct[] }) {
  return (
    <ul className="grid grid-cols-2 gap-px bg-[var(--color-hairline)] sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.handle}>
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card-hover group flex h-full flex-col border border-transparent bg-[var(--color-bg)] hover:bg-[var(--color-surface)]"
          >
            <div className="relative aspect-square overflow-hidden bg-[#101010]">
              {p.image && (
                <img
                  src={p.image}
                  alt={p.label}
                  loading="lazy"
                  className="card-zoom h-full w-full object-cover"
                />
              )}
              {!p.available && (
                <span className="type-label absolute left-0 top-0 bg-[#0b0b0b] px-3 py-1.5 text-[var(--color-steel)]">
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

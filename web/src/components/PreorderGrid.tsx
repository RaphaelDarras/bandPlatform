import type { PreorderProduct } from '../lib/shopify'

// Thumbnail cards for the featured album preorders. Images come straight from
// the Shopify CDN (already global + cached, and it content-negotiates WebP), so
// nothing is copied into public/images and the artwork updates when the band
// updates the product.
//
// Each card is its own deep link to the product page. Hover lifts the card,
// warms its border to gold and slowly zooms the artwork inside its clipped
// frame — all of it dropped under prefers-reduced-motion by the CSS.
export default function PreorderGrid({ products }: { products: PreorderProduct[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5">
      {products.map((p) => (
        <li key={p.handle}>
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card-hover group block overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)]"
          >
            <div className="relative aspect-square overflow-hidden bg-[#141414]">
              {p.image && (
                <img
                  src={p.image}
                  alt={p.label}
                  loading="lazy"
                  className="card-zoom h-full w-full object-cover"
                />
              )}
              {!p.available && (
                <span className="type-label absolute left-3 top-3 rounded-full bg-[rgba(15,15,15,0.85)] px-3 py-1 text-[var(--color-steel)] backdrop-blur-sm">
                  Sold out
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="type-label text-[var(--color-ink)]">{p.label}</p>
              <p className="mt-1.5 font-sans text-sm tabular-nums text-[var(--color-accent)]">
                {p.available ? p.price : 'Unavailable'}
              </p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  )
}

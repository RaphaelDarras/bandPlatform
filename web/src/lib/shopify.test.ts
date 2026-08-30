import { describe, it, expect } from 'vitest'
import { productsEndpoint, selectFeatured, sized, STORE_URL } from './shopify'

// Shape trimmed from the live shop.hurakanband.fr/products.json payload
// (verified 2026-08-30): titles are store-facing and shouty, prices are
// strings, images carry a ?v= cache key.
const products = [
  {
    handle: 'preorder-cd-eternal-scars',
    title: 'PREORDER - DIGIPACK - "ETERNAL SCARS"',
    images: [{ src: 'https://cdn.shopify.com/s/files/1/x/CD_MOCKUP.png?v=123' }],
    variants: [{ price: '15.00', price_currency: 'EUR', available: true }],
  },
  {
    handle: 'preorder-vinyl-eternal-scars',
    title: 'PREORDER - VINYL - "ETERNAL SCARS" SPLATTER GOLD/BLACK LIMITED',
    images: [{ src: 'https://cdn.shopify.com/s/files/1/x/VINYL.png?v=456' }],
    variants: [
      { price: '40.00', price_currency: 'EUR', available: false },
      { price: '35.00', price_currency: 'EUR', available: true },
    ],
  },
  {
    handle: 'parasite-t-shirt',
    title: 'PARASITE - T-SHIRT',
    images: [{ src: 'https://cdn.shopify.com/s/files/1/x/PARASITE.jpg?v=789' }],
    variants: [{ price: '20.00', price_currency: 'EUR', available: true }],
  },
]

describe('selectFeatured', () => {
  it('returns only the configured handles, in config order', () => {
    const out = selectFeatured(products, [
      { handle: 'preorder-vinyl-eternal-scars', label: 'Vinyl' },
      { handle: 'preorder-cd-eternal-scars', label: 'Digipack CD' },
    ])

    expect(out.map((p) => p.handle)).toEqual([
      'preorder-vinyl-eternal-scars',
      'preorder-cd-eternal-scars',
    ])
    expect(out.map((p) => p.label)).toEqual(['Vinyl', 'Digipack CD'])
  })

  it('uses the hand-authored label, never the store title', () => {
    const [p] = selectFeatured(products, [
      { handle: 'preorder-cd-eternal-scars', label: 'Digipack CD' },
    ])

    expect(p.label).toBe('Digipack CD')
    expect(JSON.stringify(p)).not.toContain('PREORDER -')
  })

  it('deep-links each product rather than the store root', () => {
    const [p] = selectFeatured(products, [
      { handle: 'preorder-cd-eternal-scars', label: 'Digipack CD' },
    ])

    expect(p.url).toBe(`${STORE_URL}products/preorder-cd-eternal-scars`)
  })

  it('prices from the cheapest variant, formatted as EUR', () => {
    const [p] = selectFeatured(products, [
      { handle: 'preorder-vinyl-eternal-scars', label: 'Vinyl' },
    ])

    // 35.00 (cheapest), not the 40.00 first variant. NBSP before the symbol is
    // fr-FR's own separator, so match loosely.
    expect(p.price.replace(/ |\s/g, ' ')).toBe('35,00 €')
  })

  it('reports availability if any variant is available', () => {
    const [vinyl] = selectFeatured(products, [
      { handle: 'preorder-vinyl-eternal-scars', label: 'Vinyl' },
    ])
    expect(vinyl.available).toBe(true)

    const soldOut = selectFeatured(
      [{ ...products[0], variants: [{ price: '15.00', available: false }] }],
      [{ handle: 'preorder-cd-eternal-scars', label: 'Digipack CD' }],
    )
    expect(soldOut[0].available).toBe(false)
  })

  it('skips handles the store no longer carries instead of rendering them broken', () => {
    const out = selectFeatured(products, [
      { handle: 'preorder-cd-eternal-scars', label: 'Digipack CD' },
      { handle: 'deleted-from-shopify', label: 'Ghost' },
    ])

    expect(out).toHaveLength(1)
    expect(out[0].handle).toBe('preorder-cd-eternal-scars')
  })

  it('tolerates a product with no image', () => {
    const out = selectFeatured(
      [{ ...products[0], images: [] }],
      [{ handle: 'preorder-cd-eternal-scars', label: 'Digipack CD' }],
    )

    expect(out[0].image).toBeNull()
  })
})

describe('selectFeatured — currency', () => {
  // The live bug: the Vercel build fetched from a US region, Shopify returned
  // 18.00 USD (~15 EUR converted), and the hardcoded EUR formatter rendered it
  // as "18,00 €". Currency must come from the payload, never be assumed.
  it('labels a USD payload in USD, never in euros', () => {
    const usd = [
      {
        ...products[0],
        variants: [{ price: '18.00', price_currency: 'USD', available: true }],
      },
    ]

    const [p] = selectFeatured(usd, [
      { handle: 'preorder-cd-eternal-scars', label: 'Digipack CD' },
    ])

    expect(p.price).not.toContain('€')
    expect(p.price).toMatch(/\$|USD/)
  })

  it('honours a zero-decimal currency', () => {
    const jpy = [
      {
        ...products[0],
        variants: [{ price: '2900', price_currency: 'JPY', available: true }],
      },
    ]

    const [p] = selectFeatured(jpy, [
      { handle: 'preorder-cd-eternal-scars', label: 'Digipack CD' },
    ])

    expect(p.price).toContain('2')
    expect(p.price).not.toContain(',00')
  })

  it('assumes EUR only when the field is absent, matching the pinned market', () => {
    const noCurrency = [
      { ...products[0], variants: [{ price: '15.00', available: true }] },
    ]

    const [p] = selectFeatured(noCurrency, [
      { handle: 'preorder-cd-eternal-scars', label: 'Digipack CD' },
    ])

    expect(p.price).toContain('€')
  })

  it('shows a bare number rather than a wrong symbol for a bad currency code', () => {
    const bad = [
      {
        ...products[0],
        variants: [{ price: '15.00', price_currency: 'NOTACURRENCY', available: true }],
      },
    ]

    const [p] = selectFeatured(bad, [
      { handle: 'preorder-cd-eternal-scars', label: 'Digipack CD' },
    ])

    expect(p.price).toBe('15')
    expect(p.price).not.toContain('€')
  })
})

describe('productsEndpoint', () => {
  // Regression: without an explicit country, products.json prices against the
  // requesting IP's market — amount AND currency. The Vercel build (US region)
  // received 18.00 USD for a product the FR store sells at 15,00 EUR.
  it('pins the market so prices do not depend on the build region', () => {
    expect(productsEndpoint()).toContain('country=FR')
  })

  it('requests the store-wide product list', () => {
    const url = new URL(productsEndpoint())
    expect(url.origin + url.pathname).toBe(`${STORE_URL}products.json`)
    expect(url.searchParams.get('limit')).toBe('250')
  })
})

describe('sized', () => {
  it('asks the Shopify CDN for a 2x width, preserving the cache key', () => {
    const out = sized('https://cdn.shopify.com/s/files/1/x/CD.png?v=123')

    expect(out).toContain('width=600')
    expect(out).toContain('v=123')
  })

  it('returns unparseable input unchanged', () => {
    expect(sized('not a url')).toBe('not a url')
  })
})

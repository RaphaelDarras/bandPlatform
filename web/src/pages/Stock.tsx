import { useEffect, useState, type FormEvent } from 'react'
import { Head } from 'vite-react-ssg'
import { AuthExpiredError, fetchStock, loginAdmin, type StockData } from '../lib/inventory'
import { stockColorClass } from '../components/StockQuantityInput'

// Stock (D-05 origin, reworked in Phase 06.1): this is now the authenticated
// admin surface for product and stock CRUD (INV-08). The login flow below is
// deliberately UNCHANGED from the legacy page — same inputs, same
// sessionStorage key, same two-effect split (D-29) — only the transport
// underneath it now goes through web/src/lib/inventory.ts instead of a
// hand-rolled fetch. Quantity editing lands in plan 06.1-09 and the
// create-product / add-variant panels in plan 06.1-10; this file is the
// shell: login, fetch, read-only rendering, Active/Archived, noindex.

export function Component() {
  const [token, setToken] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [data, setData] = useState<StockData | null>(null)
  const [loadError, setLoadError] = useState('')

  // Restore session on mount (D-29: matches legacy sessionStorage.getItem('token')).
  useEffect(() => {
    const stored = sessionStorage.getItem('token')
    if (stored) setToken(stored)
  }, [])

  useEffect(() => {
    if (token) {
      void loadStock(token)
    } else {
      setData(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // D-30 (binding): the ONLY permitted response to an expired/revoked
  // session anywhere on this page is to clear the token and drop back to
  // the login form, discarding whatever was on screen. Every call site
  // (this load, and later deactivate/restore/batch-save/create/add-variant)
  // routes its AuthExpiredError through this one helper. Do not build a
  // re-login-in-place, a token refresh (none exists server-side), a
  // dirty-form guard, or an unsaved-changes warning.
  function handleAuthExpired() {
    sessionStorage.removeItem('token')
    setToken(null)
    setData(null)
  }

  async function login(e: FormEvent) {
    e.preventDefault()
    setLoginError('')
    try {
      const result = await loginAdmin(username, password)
      sessionStorage.setItem('token', result.token)
      setToken(result.token)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  async function loadStock(authToken: string) {
    setLoadError('')
    try {
      const body = await fetchStock(authToken, true)
      setData(body)
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired()
        return
      }
      setLoadError('Failed to load stock')
    }
  }

  // D-33: hygiene only — no data is exposed (the page is login-gated and
  // runtime-fetched, and the /stock route deliberately has no loader key so
  // nothing is baked into the static prerender). This keeps the admin login
  // itself out of search results. Site-wide robots.txt/sitemap is out of
  // scope for this phase.
  const noindexTag = (
    <Head>
      <meta name="robots" content="noindex" />
    </Head>
  )

  if (!token) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        {noindexTag}
        <h1 className="font-display text-3xl uppercase text-white">Hurakan</h1>
        <form onSubmit={login} className="flex flex-col items-center gap-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="w-64 rounded-md border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3 font-sans text-white"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-64 rounded-md border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3 font-sans text-white"
          />
          <button
            type="submit"
            className="rounded-md bg-[var(--color-accent)] px-8 py-3 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-black"
          >
            Login
          </button>
          <div className="min-h-5 font-sans text-sm text-[#ef4444]">{loginError}</div>
        </form>
      </section>
    )
  }

  const visibleProducts = data ? data.products.filter((p) => p.active) : []
  const visibleUnitTotal = visibleProducts.reduce((sum, p) => sum + p.productTotal, 0)

  return (
    <section>
      {noindexTag}
      <h1 className="font-display text-3xl uppercase text-white">Stock</h1>
      {loadError && (
        <p className="pt-4 text-center font-sans text-sm text-[#ef4444]">{loadError}</p>
      )}
      {data && (
        <>
          <p className="pb-6 pt-2 text-center font-sans text-sm text-white/50">
            {visibleUnitTotal} units across {visibleProducts.length} products
          </p>
          <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4">
            {visibleProducts.map((p) => (
              <div key={p.productId}>
                <div className="flex justify-between border-b border-[var(--color-hairline)] py-2">
                  <span className="font-display text-xl uppercase text-white">{p.name}</span>
                  <span className="font-normal text-white/50">{p.productTotal} units</span>
                </div>
                <table className="mt-1 w-full">
                  <thead>
                    <tr>
                      <th className="p-2 text-left font-sans text-xs uppercase text-white/40 hidden md:table-cell">
                        SKU
                      </th>
                      <th className="p-2 text-left font-sans text-xs uppercase text-white/40">
                        Size
                      </th>
                      <th className="p-2 text-left font-sans text-xs uppercase text-white/40">
                        Color
                      </th>
                      <th className="p-2 text-left font-sans text-xs uppercase text-white/40">
                        Stock
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.variants.map((v) => (
                      <tr key={v.sku} className="border-t border-white/10">
                        <td className="p-2 font-sans text-sm text-white hidden md:table-cell">
                          {v.sku}
                        </td>
                        <td className="p-2 font-sans text-sm text-white">{v.size || '—'}</td>
                        <td className="p-2 font-sans text-sm text-white">{v.color || '—'}</td>
                        {/* D-21: a 0-stock row gets no muting, collapsing, or
                            grouping — only the shared <5 threshold colour
                            below applies. Retired sizes therefore accumulate
                            as permanent 0 rows; variant removal is out of
                            scope until Phase 7 D-15 adds a variant `active`
                            flag. */}
                        <td className={`p-2 font-sans text-sm ${stockColorClass(v.stock)}`}>
                          {v.stock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default Component

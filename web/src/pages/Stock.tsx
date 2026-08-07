import { useEffect, useState, type FormEvent } from 'react'
import { Head } from 'vite-react-ssg'
import {
  AuthExpiredError,
  deactivateProduct,
  fetchStock,
  loginAdmin,
  restoreProduct,
  type StockData,
  type StockProduct,
} from '../lib/inventory'
import { stockColorClass } from '../components/StockQuantityInput'
import { DeactivateDialog } from '../components/DeactivateDialog'

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
  // D-25: Active/Archived is a whole-view toggle over the single fetched
  // response, split client-side — not a second request, not a tab/panel.
  const [view, setView] = useState<'active' | 'archived'>('active')
  // D-22: the header-row button only ever sets this; DELETE fires solely
  // from DeactivateDialog's confirm handler, never from the bare click.
  const [pendingDeactivation, setPendingDeactivation] = useState<StockProduct | null>(null)
  const [actionInFlight, setActionInFlight] = useState(false)

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

  // D-22: fires only from DeactivateDialog's confirm action.
  async function confirmDeactivate() {
    if (!token || !pendingDeactivation || actionInFlight) return
    setActionInFlight(true)
    try {
      await deactivateProduct(token, pendingDeactivation.productId)
      setPendingDeactivation(null)
      await loadStock(token)
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired()
      } else {
        setLoadError(err instanceof Error ? err.message : 'Failed to deactivate product')
      }
    } finally {
      setActionInFlight(false)
    }
  }

  // D-27: restore is non-destructive, no confirmation dialog.
  async function handleRestore(product: StockProduct) {
    if (!token || actionInFlight) return
    setActionInFlight(true)
    try {
      await restoreProduct(token, product.productId)
      await loadStock(token)
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired()
      } else {
        setLoadError(err instanceof Error ? err.message : 'Failed to restore product')
      }
    } finally {
      setActionInFlight(false)
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

  const visibleProducts = data
    ? data.products.filter((p) => (view === 'active' ? p.active : !p.active))
    : []
  const visibleUnitTotal = visibleProducts.reduce((sum, p) => sum + p.productTotal, 0)

  return (
    <section>
      {noindexTag}
      <h1 className="font-display text-3xl uppercase text-white">Stock</h1>
      <div className="flex justify-center gap-8 pt-4">
        <button
          type="button"
          aria-pressed={view === 'active'}
          onClick={() => setView('active')}
          className={`flex h-11 items-center border-b-2 font-sans text-sm font-semibold uppercase tracking-[0.06em] ${
            view === 'active'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-white/50'
          }`}
        >
          Active
        </button>
        <button
          type="button"
          aria-pressed={view === 'archived'}
          onClick={() => setView('archived')}
          className={`flex h-11 items-center border-b-2 font-sans text-sm font-semibold uppercase tracking-[0.06em] ${
            view === 'archived'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-white/50'
          }`}
        >
          Archived
        </button>
      </div>
      {loadError && (
        <p className="pt-4 text-center font-sans text-sm text-[#ef4444]">{loadError}</p>
      )}
      {data && visibleProducts.length === 0 && (
        <div className="mx-auto max-w-md px-4 pt-8 text-center">
          <h2 className="font-display text-xl uppercase text-white">
            {view === 'active' ? 'No products yet.' : 'No archived products.'}
          </h2>
          <p className="pt-2 font-sans text-sm text-white/50">
            {view === 'active'
              ? 'Create your first product to start tracking stock.'
              : 'Deactivated products will appear here — restore them any time.'}
          </p>
        </div>
      )}
      {data && visibleProducts.length > 0 && (
        <>
          <p className="pb-6 pt-2 text-center font-sans text-sm text-white/50">
            {visibleUnitTotal} units across {visibleProducts.length} products
          </p>
          <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4">
            {visibleProducts.map((p) => (
              <div key={p.productId}>
                <div className="flex items-center justify-between border-b border-[var(--color-hairline)] py-2">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-xl uppercase text-white">{p.name}</span>
                    {view === 'archived' && (
                      <span className="rounded bg-white/10 px-2 py-0.5 font-sans text-xs uppercase text-white/60">
                        Archived
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-normal text-white/50">{p.productTotal} units</span>
                    {view === 'active' && (
                      <button
                        type="button"
                        aria-label={`Deactivate ${p.name}`}
                        disabled={actionInFlight}
                        onClick={() => setPendingDeactivation(p)}
                        className="h-11 px-2 font-sans text-xs font-semibold uppercase tracking-[0.06em] text-white/50 hover:text-[#ef4444] disabled:text-white/20"
                      >
                        Deactivate
                      </button>
                    )}
                    {view === 'archived' && (
                      <button
                        type="button"
                        aria-label={`Restore ${p.name}`}
                        disabled={actionInFlight}
                        onClick={() => void handleRestore(p)}
                        className="h-11 px-2 font-sans text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-accent)] disabled:text-white/20"
                      >
                        Restore
                      </button>
                    )}
                  </span>
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
      <DeactivateDialog
        open={pendingDeactivation !== null}
        productName={pendingDeactivation?.name ?? ''}
        productTotal={pendingDeactivation?.productTotal ?? 0}
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => setPendingDeactivation(null)}
      />
    </section>
  )
}

export default Component

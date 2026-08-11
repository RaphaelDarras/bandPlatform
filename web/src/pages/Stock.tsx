import { useEffect, useState, type FormEvent } from 'react'
import { Head } from 'vite-react-ssg'
import {
  AuthExpiredError,
  batchAdjustStock,
  deactivateProduct,
  fetchStock,
  loginAdmin,
  putProductVariants,
  restoreProduct,
  type BatchAdjustment,
  type StockData,
  type StockProduct,
  type StockVariant,
  type VariantPayload,
} from '../lib/inventory'
import { StockQuantityInput, stockColorClass } from '../components/StockQuantityInput'
import { DeactivateDialog } from '../components/DeactivateDialog'
import { CreateProductPanel } from '../components/CreateProductPanel'
import { AddVariantPanel, type PendingVariantSeed } from '../components/AddVariantPanel'

// `${productId}:${sku}` — exported so plan 06.1-10 can seed a pre-marked
// dirty row into `pending` after a D-18 partial add-variant failure.
export function rowKey(productId: string, sku: string): string {
  return `${productId}:${sku}`
}

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
  // D-04: no reason field, note field, adjustment-type selector or preset
  // picker exists anywhere on this page, and no adjustment-history or
  // audit-trail view is built here either — a deliberate exclusion per the
  // user's outright rejection of structured reasons. InventoryAdjustment's
  // reason column stays unwritten from this page.
  const [pending, setPending] = useState<Record<string, number>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  // Set by plan 06.1-10 (D-18 partial add-variant failure). Declared here so
  // it can be threaded into StockQuantityInput's `warning` prop and cleared
  // alongside a successful Save-all or a discard-changes click.
  const [rowWarnings, setRowWarnings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [labelErrors, setLabelErrors] = useState<Record<string, string>>({})
  const [labelSaving, setLabelSaving] = useState<Record<string, boolean>>({})
  // D-10/D-12: the ONE content-writing surface on this page -- see the
  // trigger's own comment below for the boundary this deliberately does not
  // cross.
  const [createOpen, setCreateOpen] = useState(false)
  // Holds the productId whose add-variant panel is open, at most one at a
  // time (D-16's sibling boundary comment lives on the trigger below).
  const [addVariantFor, setAddVariantFor] = useState<string | null>(null)
  // Per-product collapse state (presentation only). Closed by default — an
  // absent key reads as collapsed; the header row toggles its variant table
  // open/closed. Purely visual: it gates NO data write and touches no D-*
  // contract, so a collapsed product's dirty rows still count toward
  // dirtyCount and still save with Save-all.
  const [openProducts, setOpenProducts] = useState<Record<string, boolean>>({})

  function toggleProduct(productId: string) {
    setOpenProducts((prev) => ({ ...prev, [productId]: !prev[productId] }))
  }

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

  // D-07: no bound is enforced on the value — negative stock is reachable
  // by design. Only client-side rule: a non-integer/NaN typed value blocks
  // Save-all for this one row until corrected.
  function setPendingValue(key: string, next: number) {
    setPending((prev) => ({ ...prev, [key]: next }))
    setRowErrors((prev) => {
      const copy = { ...prev }
      if (!Number.isInteger(next)) {
        copy[key] = 'Quantity must be a whole number.'
      } else {
        delete copy[key]
      }
      return copy
    })
  }

  function handleDiscard() {
    setPending({})
    setRowErrors({})
    setRowWarnings({})
    setSaveError('')
  }

  // D-18 (binding, this plan's single most important contract): the
  // add-variant PUT already succeeded, so the seeded variant(s) exist
  // server-side at stock 0 -- this refetches so they appear as normal rows,
  // then pre-marks each one dirty with its INTENDED count and attaches the
  // SKU-specific amber warning, so the fix is one existing Save-all click
  // away. Recovery routes through that same transactional batch; it is never
  // a bespoke retry and never the generic D-06 "nothing was saved" banner
  // (RESEARCH Pitfall 2: the two failure vocabularies must stay separate).
  // `message` is deliberately unused/unsurfaced -- the row-scoped warning is
  // the only required user-facing signal for this path.
  async function handleAddVariantPartialFailure(
    productId: string,
    seeds: PendingVariantSeed[],
    _message: string,
  ) {
    setAddVariantFor(null)
    if (!token) return
    await loadStock(token)
    setPending((prev) => {
      const next = { ...prev }
      for (const seed of seeds) {
        next[rowKey(productId, seed.sku)] = seed.intendedStock
      }
      return next
    })
    setRowWarnings((prev) => {
      const next = { ...prev }
      for (const seed of seeds) {
        next[rowKey(productId, seed.sku)] =
          `Variant ${seed.sku} was created at 0 — its starting quantity wasn't saved. Enter the correct count below and save.`
      }
      return next
    })
  }

  // D-05/D-06: one POST commits the whole sweep, all-or-nothing. D-03
  // (binding, counter-intuitive by design): the delta for each dirty row is
  // computed HERE, at click time, from whatever `pending`/`v.stock` already
  // hold in memory — never re-fetched, never version-checked. A concurrent
  // POS sale landing between load and this click silently produces a wrong
  // count; that risk was spelled out and accepted (single admin, roughly
  // 400 POS sales/year in known post-concert bursts). Do not add a
  // re-fetch-before-save, a staleness guard, or a reconciliation step here.
  async function handleSaveAll() {
    if (!token || saving) return
    const dirtyRows = (data?.products ?? []).flatMap((p) =>
      p.variants
        .map((v) => ({ productId: p.productId, sku: v.sku, serverStock: v.stock, key: rowKey(p.productId, v.sku) }))
        .filter((r) => pending[r.key] !== undefined && pending[r.key] !== r.serverStock)
        .map((r) => ({ productId: r.productId, sku: r.sku, serverStock: r.serverStock, pendingStock: pending[r.key] })),
    )
    const hasRowError = Object.values(rowErrors).some((e) => e.length > 0)
    if (dirtyRows.length === 0 || hasRowError) return

    if (dirtyRows.length > 100) {
      setSaveError('Too many changes to save at once (max 100). Save some and try again.')
      return
    }

    const adjustments: BatchAdjustment[] = dirtyRows
      .map((r) => ({ productId: r.productId, variantSku: r.sku, quantity: r.pendingStock - r.serverStock }))
      .filter((a) => a.quantity !== 0)

    setSaving(true)
    setSaveError('')
    try {
      await batchAdjustStock(token, adjustments)
      setPending({})
      setRowErrors({})
      setRowWarnings({})
      setSaveError('')
      await loadStock(token)
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired()
      } else {
        // D-06 (binding): never clear `pending`/`rowErrors` and never
        // re-run loadStock here — a failed batch wrote nothing, so every
        // dirty row, its highlight and its typed number must survive
        // untouched so the admin can retry without redoing work.
        const message = err instanceof Error ? err.message : ''
        setSaveError(`Save failed — nothing was saved. ${message || 'Please try again.'} Your changes are still here.`)
      }
    } finally {
      setSaving(false)
    }
  }

  // D-20 (binding): size/colour edits go through the existing
  // non-transactional PUT /api/products/:id and are deliberately DECOUPLED
  // from the Save-all stock batch — they never count toward dirtyCount,
  // never block Save-all, and never flip the footer to its dirty state.
  // D-06's all-or-nothing language is specific to the new transactional
  // stock endpoint; folding labels into it would overstate an atomicity
  // guarantee that does not exist for them. `priceAdjustment` is never
  // rendered as an editable field anywhere on this page — Phase 7 D-02/D-12
  // hands price to Shopify and splits it back on pull.
  async function handleLabelBlur(
    product: StockProduct,
    variant: StockVariant,
    field: 'size' | 'color',
    nextValue: string,
  ) {
    if (!token) return
    const current = (field === 'size' ? variant.size : variant.color) ?? ''
    if (nextValue === current) return
    const cellKey = `${rowKey(product.productId, variant.sku)}:${field}`

    // D-17 (binding): PUT /api/products/:id $pulls every variant missing
    // from the payload, so this must be the product's FULL variant array
    // with only the edited field replaced on the matching SKU — never a
    // partial array.
    const fullArray: VariantPayload[] = product.variants.map((vv) => ({
      sku: vv.sku,
      size: vv.sku === variant.sku && field === 'size' ? nextValue || null : vv.size,
      color: vv.sku === variant.sku && field === 'color' ? nextValue || null : vv.color,
    }))

    setLabelSaving((prev) => ({ ...prev, [cellKey]: true }))
    setLabelErrors((prev) => {
      const copy = { ...prev }
      delete copy[cellKey]
      return copy
    })
    try {
      await putProductVariants(token, product.productId, fullArray)
      // A background refresh can never be allowed to wipe an in-progress
      // stock sweep, so only re-fetch when nothing is pending; otherwise
      // update this one field optimistically in local state.
      if (Object.keys(pending).length === 0) {
        await loadStock(token)
      } else {
        setData((prev) =>
          prev
            ? {
                ...prev,
                products: prev.products.map((pp) =>
                  pp.productId === product.productId
                    ? {
                        ...pp,
                        variants: pp.variants.map((vv) =>
                          vv.sku === variant.sku ? { ...vv, [field]: nextValue || null } : vv,
                        ),
                      }
                    : pp,
                ),
              }
            : prev,
        )
      }
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired()
      } else {
        setLabelErrors((prev) => ({ ...prev, [cellKey]: "Couldn't save this change — try again." }))
      }
    } finally {
      setLabelSaving((prev) => ({ ...prev, [cellKey]: false }))
    }
  }

  // Shared by both the Size and Color columns (Active view only) so the
  // failure copy exists exactly once in source. Row-scoped, never a
  // page-wide banner.
  function renderLabelCell(product: StockProduct, variant: StockVariant, field: 'size' | 'color') {
    const cellKey = `${rowKey(product.productId, variant.sku)}:${field}`
    const fieldLabel = field === 'size' ? 'Size' : 'Color'
    const currentValue = (field === 'size' ? variant.size : variant.color) ?? ''
    const inputId = `label-${field}-${product.productId}-${variant.sku}`
    const errId = `label-err-${field}-${product.productId}-${variant.sku}`
    const isSaving = labelSaving[cellKey] ?? false
    const error = labelErrors[cellKey]

    return (
      <td className="p-2">
        <label htmlFor={inputId} className="sr-only">
          {`${fieldLabel} for ${product.name} (${variant.sku})`}
        </label>
        <input
          id={inputId}
          type="text"
          defaultValue={currentValue}
          onBlur={(e) => void handleLabelBlur(product, variant, field, e.target.value)}
          disabled={isSaving}
          aria-describedby={error ? errId : undefined}
          className={`h-11 w-full border-b bg-transparent px-1 font-sans text-sm text-white focus:border-white/40 ${
            isSaving ? 'animate-pulse border-[var(--color-accent)]' : 'border-transparent'
          }`}
        />
        {error && (
          <p role="alert" id={errId} className="font-sans text-xs text-[#ef4444]">
            {error}
          </p>
        )}
      </td>
    )
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

  const dirtyCount = data
    ? data.products.reduce(
        (count, p) =>
          count +
          p.variants.filter((v) => {
            const key = rowKey(p.productId, v.sku)
            return pending[key] !== undefined && pending[key] !== v.stock
          }).length,
        0,
      )
    : 0
  const hasRowError = Object.values(rowErrors).some((e) => e.length > 0)
  // Every SKU across every loaded product, active AND archived, so the
  // generator's D-14 client warning also catches a clash against an
  // archived product's SKU.
  const allSkus = data ? data.products.flatMap((p) => p.variants.map((v) => v.sku)) : []

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
      {view === 'active' && data && (
        <div className="mx-auto max-w-2xl px-4 pt-6">
          {/* D-10 (binding): this trigger only ever mounts CreateProductPanel,
              which CREATES a brand-new product. There is no control anywhere
              on this page -- here or in the per-product rows below -- that
              edits a saved product's name, description, base price or
              images. Creation is deliberately the only content-writing path
              in this phase: Phase 7 D-02 makes Shopify the content master,
              so an editor built here would just be a form whose edits the
              Shopify pull silently overwrites. Accepted consequence: until
              Phase 7 ships, a typo in a product name has no in-app fix. */}
          <button
            type="button"
            onClick={() => setCreateOpen((open) => !open)}
            className="h-11 w-full rounded-md border border-[var(--color-hairline)] bg-transparent px-4 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-[var(--color-accent)]"
          >
            {createOpen ? 'Cancel' : '+ Add product'}
          </button>
          {createOpen && (
            <div className="pt-4">
              <CreateProductPanel
                token={token}
                existingSkus={allSkus}
                onCreated={() => {
                  setCreateOpen(false)
                  void loadStock(token)
                }}
                onCancel={() => setCreateOpen(false)}
                onAuthExpired={handleAuthExpired}
              />
            </div>
          )}
        </div>
      )}
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
            {visibleProducts.map((p) => {
              const isOpen = openProducts[p.productId] ?? false
              const panelId = `stock-panel-${p.productId}`
              return (
              <div key={p.productId}>
                <div className="flex items-center gap-2 border-b border-[var(--color-hairline)] py-2">
                  {/* The whole name+units line is the collapse toggle. The
                      Deactivate/Restore control is a SIBLING, never nested, so
                      clicking it acts on the product without also toggling the
                      panel (and stays valid — no button inside a button). */}
                  <button
                    type="button"
                    aria-label={`Toggle variants for ${p.name}`}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleProduct(p.productId)}
                    className="flex flex-1 items-center justify-between gap-2 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${
                          isOpen ? 'rotate-90' : ''
                        }`}
                      >
                        <path d="M7 5l6 5-6 5V5z" />
                      </svg>
                      <span className="font-display text-xl uppercase text-white">{p.name}</span>
                      {view === 'archived' && (
                        <span className="rounded bg-white/10 px-2 py-0.5 font-sans text-xs uppercase text-white/60">
                          Archived
                        </span>
                      )}
                    </span>
                    <span className="font-normal text-white/50">{p.productTotal} units</span>
                  </button>
                  {view === 'active' && (
                    <button
                      type="button"
                      aria-label={`Deactivate ${p.name}`}
                      disabled={actionInFlight}
                      onClick={() => setPendingDeactivation(p)}
                      className="h-11 shrink-0 px-2 font-sans text-xs font-semibold uppercase tracking-[0.06em] text-white/50 hover:text-[#ef4444] disabled:text-white/20"
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
                      className="h-11 shrink-0 px-2 font-sans text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-accent)] disabled:text-white/20"
                    >
                      Restore
                    </button>
                  )}
                </div>
                {isOpen && (
                <div id={panelId}>
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
                    {p.variants.map((v) => {
                      const key = rowKey(p.productId, v.sku)
                      const dirty = view === 'active' && pending[key] !== undefined && pending[key] !== v.stock
                      return (
                        <tr
                          key={v.sku}
                          className={`border-t border-white/10 ${
                            dirty
                              ? 'border-l-[3px] border-l-[var(--color-accent)] bg-[rgba(200,188,134,0.06)]'
                              : ''
                          }`}
                        >
                          <td className="p-2 font-sans text-sm text-white hidden md:table-cell">
                            {v.sku}
                          </td>
                          {view === 'archived' ? (
                            <td className="p-2 font-sans text-sm text-white">{v.size || '—'}</td>
                          ) : (
                            renderLabelCell(p, v, 'size')
                          )}
                          {view === 'archived' ? (
                            <td className="p-2 font-sans text-sm text-white">{v.color || '—'}</td>
                          ) : (
                            renderLabelCell(p, v, 'color')
                          )}
                          {/* D-21: a 0-stock row gets no muting, collapsing, or
                              grouping — only the shared <5 threshold colour
                              below applies. Retired sizes therefore accumulate
                              as permanent 0 rows; variant removal is out of
                              scope until Phase 7 D-15 adds a variant `active`
                              flag. */}
                          {view === 'archived' ? (
                            <td className={`p-2 font-sans text-sm ${stockColorClass(v.stock)}`}>
                              {v.stock}
                            </td>
                          ) : (
                            <td className="p-2">
                              <StockQuantityInput
                                productName={p.name}
                                sku={v.sku}
                                size={v.size}
                                color={v.color}
                                value={pending[key] ?? v.stock}
                                serverValue={v.stock}
                                onChange={(next) => setPendingValue(key, next)}
                                error={rowErrors[key]}
                                warning={rowWarnings[key]}
                                disabled={saving}
                              />
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {view === 'active' && (
                  <div className="pt-2">
                    {/* D-16 (binding): this trigger only ever ADDS new
                        variants to this already-saved product. There is no
                        remove/delete control anywhere on a saved variant
                        row -- Orders and Sales reference variants by
                        variantSku (Phase 8 exists to protect exactly that
                        history), and Phase 7 D-15 will add the
                        variant-level `active` flag that makes soft-removal
                        correct. The generator's own prune "x" (inside the
                        panel below) only removes an unsaved preview row,
                        which is a different operation. */}
                    <button
                      type="button"
                      aria-label={`Add variant to ${p.name}`}
                      onClick={() =>
                        setAddVariantFor((current) => (current === p.productId ? null : p.productId))
                      }
                      className="h-11 font-sans text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-accent)]"
                    >
                      + Add variant
                    </button>
                    {addVariantFor === p.productId && (
                      <div className="pt-2">
                        <AddVariantPanel
                          token={token}
                          productId={p.productId}
                          productName={p.name}
                          existingVariants={p.variants}
                          existingSkus={allSkus}
                          onAdded={() => {
                            setAddVariantFor(null)
                            void loadStock(token)
                          }}
                          onPartialFailure={(seeds, message) =>
                            void handleAddVariantPartialFailure(p.productId, seeds, message)
                          }
                          onCancel={() => setAddVariantFor(null)}
                          onAuthExpired={handleAuthExpired}
                        />
                      </div>
                    )}
                  </div>
                )}
                </div>
                )}
              </div>
              )
            })}
          </div>
        </>
      )}
      {/* D-26: the sticky Save-all footer renders in the Active view only,
          and only once product data has loaded — never in Archived. */}
      {data && view === 'active' && (
        <div className="sticky bottom-0 z-40 border-t border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-2">
          {saveError && (
            <p role="alert" className="pb-2 text-center font-sans text-sm text-[#ef4444]">
              {saveError}
            </p>
          )}
          <div className="flex h-11 items-center justify-end gap-4">
            {dirtyCount > 0 && !saving && (
              <button
                type="button"
                onClick={handleDiscard}
                className="font-sans text-sm text-white/50 underline"
              >
                Discard changes
              </button>
            )}
            <button
              type="button"
              disabled={saving || dirtyCount === 0 || hasRowError}
              onClick={() => void handleSaveAll()}
              className={`flex h-11 items-center gap-2 px-6 font-sans text-sm font-semibold uppercase tracking-[0.06em] ${
                saving || dirtyCount === 0 || hasRowError
                  ? 'bg-white/20 text-white/40'
                  : 'bg-[var(--color-accent)] text-black'
              }`}
            >
              {saving ? 'Saving…' : dirtyCount > 0 ? `Save all changes (${dirtyCount})` : 'Save all'}
            </button>
          </div>
        </div>
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

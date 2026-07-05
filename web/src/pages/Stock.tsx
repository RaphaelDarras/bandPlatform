import { useEffect, useState, type FormEvent } from 'react'

// Stock (D-05): migrated from website/stock/index.html as a functionally
// equivalent React route. This is the one route that makes a runtime API
// call — the personal-use inventory page hitting the existing Render
// backend, unrelated to Bandsintown/D-09. Preserves the legacy page's
// login + inventory fetch + 401/403 handling verbatim; enhancement is
// explicitly deferred (D-05).

const API = 'https://hurakan-band-platform.onrender.com'

interface StockVariant {
  sku: string
  size?: string
  color?: string
  stock: number
}

interface StockProduct {
  name: string
  productTotal: number
  variants: StockVariant[]
}

interface StockData {
  grandTotal: number
  productCount: number
  products: StockProduct[]
}

// Intentional divergence from the shop's StockBadge (web/src/components/StockBadge.tsx),
// which uses `< 5` per CONTEXT.md D-15. This admin page keeps `<= 5` for its amber
// warning. The split is deliberate and scoped to these two call sites — do not "fix"
// one threshold to match the other without checking CONTEXT.md D-15 first.
function stockColorClass(stock: number) {
  if (stock === 0) return 'text-[#ef4444]' // stock-zero (danger)
  if (stock <= 5) return 'text-[#f59e0b]' // stock-low (warning)
  return 'text-[#22c55e]' // stock-ok (success)
}

export function Component() {
  const [token, setToken] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [data, setData] = useState<StockData | null>(null)
  const [loadError, setLoadError] = useState('')

  // Restore session on mount (matches legacy `sessionStorage.getItem('token')`).
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

  async function login(e: FormEvent) {
    e.preventDefault()
    setLoginError('')
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Login failed')
      sessionStorage.setItem('token', body.token)
      setToken(body.token)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  async function loadStock(authToken: string) {
    setLoadError('')
    try {
      const res = await fetch(`${API}/api/inventory/stock`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem('token')
        setToken(null)
        setData(null)
        return
      }
      const body = (await res.json()) as StockData
      setData(body)
    } catch {
      setLoadError('Failed to load stock')
    }
  }

  if (!token) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
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

  return (
    <section>
      <h1 className="font-display text-3xl uppercase text-white">Stock</h1>
      {loadError && (
        <p className="pt-4 text-center font-sans text-sm text-[#ef4444]">{loadError}</p>
      )}
      {data && (
        <>
          <p className="pb-6 pt-2 text-center font-sans text-sm text-white/50">
            {data.grandTotal} units across {data.productCount} products
          </p>
          <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4">
            {data.products.map((p) => (
              <div key={p.name}>
                <div className="flex justify-between border-b border-[var(--color-hairline)] py-2 font-sans font-bold text-white">
                  <span>{p.name}</span>
                  <span className="font-normal text-white/50">{p.productTotal} units</span>
                </div>
                <table className="mt-1 w-full">
                  <thead>
                    <tr>
                      <th className="p-2 text-left font-sans text-xs uppercase text-white/40">
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
                        <td className="p-2 font-sans text-sm text-white">{v.sku}</td>
                        <td className="p-2 font-sans text-sm text-white">{v.size || '—'}</td>
                        <td className="p-2 font-sans text-sm text-white">{v.color || '—'}</td>
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

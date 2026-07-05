// 3-state stock indicator (SHOP-13 / D-15). Colors lifted verbatim from
// Stock.tsx's stockColorClass (#ef4444 / #f59e0b / #22c55e) — no new colors
// introduced. Rendered as plain colored Label-role text (not a filled pill),
// matching Stock.tsx's existing text-only convention.
//
// Divergence from Stock.tsx's stockColorClass (<= 5) is intentional — see
// CONTEXT.md D-15 reconcile note. This customer-facing badge uses `< 5` for
// its low-stock threshold. Do not "fix" one threshold to match the other.
function stockStatus(stock: number): { colorClass: string; label: string } {
  if (stock === 0) return { colorClass: 'text-[#ef4444]', label: 'Out of Stock' }
  if (stock < 5) return { colorClass: 'text-[#f59e0b]', label: `Low Stock — ${stock} left` }
  return { colorClass: 'text-[#22c55e]', label: 'In Stock' }
}

export default function StockBadge({ stock }: { stock: number }) {
  const { colorClass, label } = stockStatus(stock)

  return (
    <span className={`font-sans text-sm font-semibold uppercase tracking-[0.06em] ${colorClass}`}>
      {label}
    </span>
  )
}

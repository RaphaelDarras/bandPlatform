// Client-only cart store — the codebase's first global client state
// (zustand, D-12). Persisted to localStorage but never read at module-init
// time: `skipHydration: true` defers the read until an explicit
// `useCartStore.persist.rehydrate()` call, made once from Layout.tsx after
// mount (D-12). This avoids the classic SSR/SSG hydration-mismatch class of
// bug — the prerendered shell for `/cart` has no idea what's in localStorage
// at build time, so we must never read it synchronously at import time.
//
// addLine merges by productId+variantSku and caps the resulting quantity at
// stockCap via Math.min (D-13) — adding more of a variant already in the
// cart increments rather than duplicates the line, and never exceeds stock.
//
// setQuantity/removeLine/clearCart are the remaining mutations the cart page
// needs (D-14: cart revalidation flags stale lines but never silently
// auto-adjusts them — that flagging logic lives in Cart.tsx, not here).

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartLine {
  productId: string
  variantSku: string
  quantity: number
  name: string
  variantLabel: string
  unitPrice: number
  image: string
}

export interface CartState {
  lines: CartLine[]
  hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  addLine: (line: CartLine, stockCap: number) => void
  setQuantity: (productId: string, variantSku: string, quantity: number) => void
  removeLine: (productId: string, variantSku: string) => void
  clearCart: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      addLine: (line, stockCap) =>
        set((state) => {
          const existing = state.lines.find(
            (l) => l.productId === line.productId && l.variantSku === line.variantSku,
          )
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l === existing
                  ? { ...l, quantity: Math.min(l.quantity + line.quantity, stockCap) } // D-13
                  : l,
              ),
            }
          }
          return { lines: [...state.lines, line] }
        }),
      setQuantity: (productId, variantSku, quantity) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.productId === productId && l.variantSku === variantSku ? { ...l, quantity } : l,
          ),
        })),
      removeLine: (productId, variantSku) =>
        set((state) => ({
          lines: state.lines.filter(
            (l) => !(l.productId === productId && l.variantSku === variantSku),
          ),
        })),
      clearCart: () => set({ lines: [] }),
    }),
    {
      name: 'hurakan-cart',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true, // D-12 — never auto-read localStorage during module init
    },
  ),
)

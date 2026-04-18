---
id: SEED-001
status: dormant
planted: 2026-04-19
planted_during: Phase 3 (Mobile POS Optimization — not yet planned)
trigger_when: Phase 5 (Online Shop Core) — specifically the guest-checkout flow that starts creating Order documents with source='online', status='pending'
scope: Medium
---

# SEED-001: Gate "Needs Reproduction" alert on pending online orders

## The Idea

Only display the dashboard "Needs Reproduction" alert on a variant when **both** are true:

1. The variant's stock has dropped to 0 (or below)
2. There is at least one pending online order on that variant

Today the alert fires on condition (1) alone.

## Why This Matters

The alert exists to tell the band "reproduce this item — you've sold out." But without a demand signal, every out-of-stock variant triggers the alert, including:

- Items that sold out at a concert and will be restocked when convenient
- Seasonal / one-off merch that doesn't need reproducing
- Items we're winding down

Gating on a pending online order means the alert fires only when there's **an identified customer waiting for the item**. That changes it from a noisy "you're low" signal into a precise "someone paid / committed, you owe them a unit" signal — which is the urgency that actually warrants the red alert card on the dashboard.

Secondary benefit: the deficit screen can gain a "customers waiting" counter per variant, giving reproduction priorities natural ordering.

## When to Surface

**Trigger:** Phase 5 (Online Shop Core) — when guest-checkout order creation ships.

This seed should be presented during `/gsd-new-milestone` (or `/gsd-discuss-phase` for Phase 5) when the milestone scope matches any of these conditions:

- Online shop / e-commerce catalog work begins
- Guest-checkout order creation goes live
- Stripe / PayPal payment integration lands (Phase 6) — if Phase 5 defers order-writing to payment confirmation
- Any phase that starts writing `Order` documents with `source: 'online'` and `status: 'pending'`

Do **not** surface before online orders flow: with zero online orders in the system, the gated alert never fires and the feature silently disappears — worse than today.

## Scope Estimate

**Medium** — a full phase or a meaty cross-stack plan:

1. **Backend:** new aggregation exposing per-variant pending-online-order counts. Candidates: `GET /inventory/demand` returning `{ productId, variantSku, pendingOnlineQty }[]`, or extending the stock endpoint with a `pendingOnlineQty` field per variant. Needs to filter `Order.find({ status: 'pending', source: 'online' })` and aggregate quantities by variantSku.
2. **Mobile:** extend the stock cache to carry `pendingOnlineQty` per variant, refresh alongside stock on focus. Update `needsReproduction` computation in `useStock.ts` to require `stock <= 0 && pendingOnlineQty > 0`.
3. **Deficit screen:** show "N waiting online" per variant. Optional: sort by waiting-count descending.
4. **Open decision:** do we keep a separate lower-priority "low stock for concerts" signal for variants that are out of stock but have no online order? Or drop it entirely? This seed recommends **dropping it** — the band can see out-of-stock via the Stock tab; the dashboard alert is specifically for fulfillment urgency.

## Breadcrumbs

Current implementation and related surfaces:

- `mobile/src/features/stock/useStock.ts:128-132` — the current `needsReproduction` filter (`v.stock <= 0`)
- `mobile/src/app/(tabs)/index.tsx` — dashboard `deficit` card reads `needsReproduction.length` for badge + alert styling
- `mobile/src/app/deficit.tsx` — deficit screen (routed from the dashboard card)
- `api/models/Order.js` — `Order` model with `status: 'pending' | 'paid' | 'failed' | 'shipped' | 'delivered'` and `source` default `'online'`
- `api/routes/inventory.js` — existing reservation endpoints (`/reserve`, `/release`) — reservation data is a parallel signal that could also inform demand gating
- `api/models/Product.js` — variants live here (stock, variantSku)
- `.planning/ROADMAP.md` — Phase 5 (Online Shop Core) and Phase 6 (Payment Processing) are the natural home

## Notes

- Captured during a quick-task session on 2026-04-19 after the user asked to change the alert's trigger condition.
- Routing decision: the literal request was unworkable today (no online orders flow yet → alert would always be silent), so the work was parked as a seed instead of dispatched as a quick task.
- Related seed candidate (not planted): when online orders ship, revisit whether the deficit badge count should reflect *variants with demand* vs *total units owed* — they tell different operational stories.

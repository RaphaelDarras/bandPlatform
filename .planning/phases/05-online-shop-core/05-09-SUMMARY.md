---
phase: 05-online-shop-core
plan: 09
subsystem: web-shop
tags: [checkout, form, validation, guest-checkout]
dependency-graph:
  requires: ["05-05"]
  provides: ["guest-checkout-form"]
  affects: ["web/src/pages/Checkout.tsx"]
tech-stack:
  added: []
  patterns:
    - "Controlled-input form styling copied verbatim from Stock.tsx's login form (border-[var(--color-hairline)]/bg-[var(--color-surface)] inputs, min-h-5 error slots)"
    - "Validate-on-blur, re-validate-on-change-once-touched pattern for inline field errors"
key-files:
  created:
    - web/src/pages/Checkout.tsx
    - web/src/pages/Checkout.test.tsx
  modified: []
decisions:
  - "Place Order button uses type=\"button\" with an unconditional disabled attribute and the <form> has no onSubmit at all — there is no submit path to short-circuit, not just a disabled one (D-01/D-03)"
  - "All free-text fields (name, address lines, city, postal code, country) carry a maxLength bound, not just country — T-5-15 names 'free-text country + address fields' plural, so the mitigation was applied to the whole address block, not only the field the acceptance criteria explicitly checks"
  - "addressLine2 is the only optional field; all other fields (email, name, addressLine1, city, postalCode, country) are required with inline errors"
metrics:
  duration: 8 minutes
  completed: 2026-07-05
---

# Phase 5 Plan 9: Guest Checkout Form Summary

Full guest-checkout form (email, name, shipping address) with client-side validation and inline errors, an order summary reading live cart subtotal, and a permanently-disabled "Place Order" button with an "online payment coming soon" note — form-only, no submit path, no Order persisted (Phase 6 boundary).

## What Was Built

- `web/src/pages/Checkout.tsx` — default-exported `Component`, `max-w-md` single column. Two `<fieldset>` groups: Contact (email) and Shipping (name, addressLine1, addressLine2 optional, city, postalCode, country). Controlled inputs via `useState`, validated on blur and (once touched) on every subsequent change, with per-field inline error slots (`min-h-5 text-[#ef4444]`, mirroring `Stock.tsx`'s login-form error-slot pattern). Order summary block reads `useCartStore` lines and computes subtotal inline (`lines.reduce(...)`), styled like `Cart.tsx`'s summary card. "Place Order" is `type="button"`, unconditionally `disabled`, `bg-white/20 text-white/40 cursor-not-allowed`; the coming-soon note sits directly beneath it. The `<form>` has no `onSubmit` at all.
- `web/src/pages/Checkout.test.tsx` — 9 tests: all fields render; empty-email-on-blur error; invalid-format email error; error clears once a valid email is entered; empty required-shipping-field error (city); Place Order disabled + coming-soon note + disabled-button classes; subtotal renders from cart store; country is a free-text `<input maxLength>` with no `<select>` anywhere; no `onSubmit` attribute and button `type="button"` (no submit path).

## Deviations from Plan

None — plan executed exactly as written. The only addition beyond the plan's literal wording was extending the maxLength mitigation (T-5-15) to all free-text fields, not just country, since the threat model's mitigation text says "free-text country + address fields" (plural) — this is Rule 2 (auto-add missing critical functionality / threat-model mitigation), applied to fields the threat register already scoped in.

## Verification

- `npm run test -w web -- Checkout` — 9/9 passed.
- `npm run test -w web` (full suite) — 105/105 passed, no regressions.
- `npx tsc --noEmit` in `web/` — clean, no type errors.
- Source assertions confirmed manually: Place Order has unconditional `disabled` + `bg-white/20 text-white/40 cursor-not-allowed`; note copy "Online payment is coming soon" present; country `<input maxLength>` with no `<select>`; no fetch/API call anywhere in the file.

## Known Stubs

None — this page is intentionally form-only per D-01/D-03; the disabled submit and lack of persistence are the documented Phase 6 boundary, not an unintentional stub.

## Threat Flags

None — all three threat-register entries (T-5-14 reflected-XSS via JSX auto-escaping, T-5-15 DoS via maxLength bounds, T-5-16 disabled-submit/no-onSubmit) were mitigated as specified; no new surface introduced beyond what the plan's threat model anticipated.

## Self-Check: PASSED

- FOUND: web/src/pages/Checkout.tsx
- FOUND: web/src/pages/Checkout.test.tsx
- FOUND commit: dfe4e1b (feat(05-09): add guest-checkout form with validation and disabled Place Order)

---
phase: 2
slug: mobile-pos-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 + jest-expo (mobile), Jest 30 + Supertest (API) |
| **Config file (API)** | `api/package.json` jest config (`testEnvironment: node`) |
| **Config file (mobile)** | `mobile/jest.config.js` — Wave 0 creates |
| **Quick run command (API)** | `cd api && npm test` |
| **Quick run command (mobile)** | `cd mobile && npm test` |
| **Full suite command** | `npm run test:all` (root script — Wave 0 creates) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mobile && npm test -- --testPathPattern={changed_feature} --passWithNoTests`
- **After every plan wave:** Run `cd api && npm test && cd ../mobile && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | POS-01 | unit | `cd mobile && npm test -- --testPathPattern=db/outbox` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | POS-09, POS-10 | unit | `cd mobile && npm test -- --testPathPattern=stores/cartStore` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 0 | POS-05, AUTH-01 | unit | `cd mobile && npm test -- --testPathPattern=features/auth` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 0 | POS-02 | unit (RTL) | `cd mobile && npm test -- --testPathPattern=features/catalog` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 0 | POS-03 | unit | `cd mobile && npm test -- --testPathPattern=features/history` | ❌ W0 | ⬜ pending |
| 02-01-06 | 01 | 0 | POS-04 | unit | `cd mobile && npm test -- --testPathPattern=features/stock` | ❌ W0 | ⬜ pending |
| 02-01-07 | 01 | 0 | AUTH-01 | integration | `cd api && npm test -- --testPathPattern=tests/pin-auth` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `mobile/jest.config.js` — jest-expo preset configuration
- [ ] `mobile/src/__tests__/db/outbox.test.ts` — stubs for POS-01 (outbox + sale atomicity)
- [ ] `mobile/src/__tests__/stores/cartStore.test.ts` — stubs for POS-09, POS-10 (cart + totals)
- [ ] `mobile/src/__tests__/features/auth/pinAuth.test.ts` — stubs for POS-05, AUTH-01 (PIN auth)
- [ ] `mobile/src/__tests__/features/catalog/productGrid.test.tsx` — stubs for POS-02 (product grid)
- [ ] `mobile/src/__tests__/features/history/history.test.ts` — stubs for POS-03 (transaction history)
- [ ] `mobile/src/__tests__/features/stock/stock.test.ts` — stubs for POS-04 (stock levels)
- [ ] `api/tests/pin-auth.test.js` — stubs for AUTH-01 PIN endpoint
- [ ] `api/tests/concerts.test.js` — stubs for concert CRUD endpoints
- [ ] `api/tests/sales-batch.test.js` — stubs for batch sale submission with idempotency
- [ ] Root `package.json` script `test:all` that runs both API and mobile suites

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Touch-friendly UI at concert venue | POS-02 | Ergonomics require physical device testing | Test on iPhone SE + Android mid-range with large touch targets |
| Offline sale at venue without internet | POS-01 | Requires airplane mode + physical device | Enable airplane mode, complete full sale flow, verify SQLite entry |
| Sync resumes on connectivity restore | POS-01 | Network state change requires real device | Toggle airplane mode off, verify outbox drains to API |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

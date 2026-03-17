---
phase: 01
slug: foundation-inventory-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework installed |
| **Config file** | None — Wave 0 gap |
| **Quick run command** | `node -e "require('./api/models/InventoryAdjustment')"` |
| **Full suite command** | N/A |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `node -e` module load check
- **After every plan wave:** Manual API endpoint verification
- **Before `/gsd:verify-work`:** All endpoints must respond correctly
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-04-01 | 04 | 1 | INV-01, INV-03, INV-04 | module-load | `node -e "require('./api/models/InventoryAdjustment'); const r = require('./api/routes/inventory'); console.log('OK')"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework installed (jest, vitest, or mocha) — not in scope for gap closure
- [ ] No test files exist under `api/`

*If tests are desired in future, recommend jest + supertest for Express HTTP endpoint testing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| POST /restock increases stock | INV-03 | No test framework | curl POST with auth token, verify stock increased |
| GET /audit includes restock entries | INV-04 | No test framework | Restock a variant, then GET /audit and verify entry appears |
| Restock returns 409 on version conflict | INV-02 | No test framework | Read variant, deduct from another client, then restock with stale version |
| Admin password stored as bcrypt hash | AUTH-02 | No test framework | Already verified in plans 01-01/01-02 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

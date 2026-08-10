# Deferred Items — Phase 07 Shopify Integration

Out-of-scope discoveries logged during execution. Do NOT fix as part of the
originating plan.

## From 07-02

- **[pre-existing] Mongoose "Duplicate schema index on {orderNumber:1}" warning.**
  `api/models/Order.js` declares `orderNumber` with `unique: true` (which
  implicitly builds an index) AND an explicit `OrderSchema.index({ orderNumber: 1 })`
  (line ~140). This prints a duplicate-index warning on every model load. It
  predates 07-02 and is unrelated to the Shopify fields added here. Fix later by
  dropping one of the two declarations (keep `unique: true`, remove the explicit
  `.index()` — or vice versa). No behavioral impact; index is still created once.

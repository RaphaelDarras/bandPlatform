# Phase 01: Foundation & Inventory Core - Research

**Researched:** 2026-03-12
**Domain:** Node.js/Express REST API, MongoDB/Mongoose, optimistic locking, inventory audit trails
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Database:** MongoDB with Mongoose (user preference over PostgreSQL)
- **Schema:** Single Products collection with embedded variants; per-variant version field for optimistic locking
- **Inventory tracking:** Inventory changes tracked within Orders/Sales documents only — no separate Inventory collection
- **Concurrency strategy:** Optimistic locking per-variant; fail immediately on version conflict (no retry), return "out of stock" error
- **Concert structure:** Simple concert documents; Sales link to concert via concert_id reference; no pre-allocation of stock
- **Online checkout flow:** 10-minute stock reserve during checkout; auto-restore on payment failure; deduct after successful payment webhook
- **POS offline:** Offline POS uses last-known stock (accepts risk of conflicts); first write wins on sync
- **Low stock threshold:** Below 5 units triggers warnings

### Claude's Discretion
- Exact MongoDB query patterns and indexes
- Error message wording for stock conflicts
- Logging strategy for inventory changes
- API endpoint structure and naming
- Authentication token expiration timing

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INV-01 | System maintains unified inventory across online and POS channels | Product model with embedded variants is the single source of truth; GET /api/products provides centralized queries |
| INV-02 | System prevents overselling when both channels are active | Optimistic locking with per-variant version field; MongoDB findOneAndUpdate with version match condition |
| INV-03 | System updates stock in real-time after each sale | Atomic findOneAndUpdate; restock endpoint must also use atomic update |
| INV-04 | System maintains inventory transaction logs for auditing | Order/Sale documents hold stockBefore/stockAfter; new InventoryAdjustment model for restock audit trail |
| AUTH-02 | System securely stores authentication credentials | bcrypt salt rounds 10 in Admin model pre-save hook; JWT Bearer token middleware implemented |
</phase_requirements>

---

## Summary

Plans 01-01 through 01-03 are complete. The foundation is fully built: MongoDB schema with embedded variants and per-variant version fields, bcrypt-hashed admin credentials, JWT authentication middleware, and REST API endpoints for products, auth, and inventory (deduct, reserve, release, audit). The implementation correctly satisfies INV-01, INV-02, INV-03, and AUTH-02.

The single gap is plan 01-04: there is no way to increase stock once a product is created. `PUT /api/products/:id` explicitly blocks stock changes, and `POST /api/inventory` only supports deduct, reserve, and release. This is a genuine gap — without a restock endpoint, the inventory cannot be replenished and the audit trail is one-sided (losses only, no gains).

The gap closure requires a new `POST /api/inventory/restock` endpoint and a new `InventoryAdjustment` Mongoose model. The existing optimistic locking pattern from `/deduct` must be reused exactly, and the `GET /audit` aggregation must be extended to include restock entries.

**Primary recommendation:** Add `api/models/InventoryAdjustment.js` and extend `api/routes/inventory.js` with `/restock` + updated `/audit`. Follow the exact optimistic locking pattern already in the codebase — no new patterns are needed.

---

## Standard Stack

### Core (already installed — no new installs needed for plan 01-04)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.22.1 | HTTP server and routing | Already in use |
| mongoose | ^8.23.0 | MongoDB ODM with schema validation | Already in use |
| bcrypt | ^5.1.1 | Password hashing | Already in use |
| jsonwebtoken | ^9.0.3 | JWT generation and verification | Already in use |
| dotenv | ^16.6.1 | Environment variable loading | Already in use |
| swagger-jsdoc | ^6.2.8 | API documentation generation | Already in use |
| swagger-ui-express | ^5.0.1 | Swagger UI serving | Already in use |

### No new dependencies required for plan 01-04

The restock endpoint uses the same stack as existing inventory endpoints. Zero new packages needed.

---

## Architecture Patterns

### Existing Project Structure
```
api/
├── config/
│   ├── database.js        # MongoDB connection (connectDatabase)
│   └── swagger.js         # Swagger config
├── middleware/
│   └── auth.js            # authenticateToken middleware
├── models/
│   ├── Admin.js           # bcrypt pre-save hook, comparePassword method
│   ├── Concert.js         # Concert schema (date, location, venue, active)
│   ├── Order.js           # Online order with embedded items (stockBefore/stockAfter)
│   ├── Product.js         # Embedded VariantSchema with version field
│   └── Sale.js            # POS sale with embedded items (stockBefore/stockAfter)
├── routes/
│   ├── auth.js            # POST /login, POST /verify
│   ├── inventory.js       # POST /deduct, /reserve, /release, GET /audit
│   └── products.js        # GET /, GET /:id, POST /, PUT /:id, DELETE /:id
├── utils/
│   └── seedAdmin.js       # Admin seed script
└── index.js               # Express app setup and server start
```

### Pattern 1: Optimistic Locking (per-variant version field)

**What:** Read variant.version, use it in the findOneAndUpdate match condition, increment atomically. If the document is not found, another process updated the variant first — return 409.

**When to use:** Every stock-modifying operation (deduct, reserve, release, restock).

**Exact pattern used in codebase (MUST replicate in /restock):**
```javascript
// Source: api/routes/inventory.js (existing implementation)

// Step 1: Find product and read current state
const product = await Product.findOne({
  _id: productId,
  'variants.sku': variantSku
});
if (!product) {
  return res.status(404).json({ error: 'Product or variant not found' });
}
const variant = product.variants.find(v => v.sku === variantSku);
const stockBefore = variant.stock;

// Step 2: Atomic update with version check
const updatedProduct = await Product.findOneAndUpdate(
  {
    _id: productId,
    'variants.sku': variantSku,
    'variants.$.version': variant.version  // version lock
  },
  {
    $inc: {
      'variants.$.stock': +quantity,  // positive for restock (vs -quantity for deduct)
      'variants.$.version': 1
    }
  },
  { new: true }
);

// Step 3: Version conflict detection
if (!updatedProduct) {
  return res.status(409).json({
    error: 'Stock conflict - version mismatch. Please retry with updated stock data.'
  });
}

const updatedVariant = updatedProduct.variants.find(v => v.sku === variantSku);
const stockAfter = updatedVariant.stock;
```

### Pattern 2: Audit Trail Creation

**What:** After a successful atomic stock update, create an audit document (Order, Sale, or InventoryAdjustment) with stockBefore and stockAfter.

**Critical note:** Audit document is created AFTER the atomic update succeeds. If audit creation fails, stock was already modified — this is an accepted risk (eventual consistency for audit trail vs. mandatory for stock accuracy).

**For /restock, the new InventoryAdjustment model:**
```javascript
// Source: 01-04-PLAN.md (prescribed pattern for new model)
await InventoryAdjustment.create({
  productId,
  variantSku,
  type: 'restock',
  quantity,
  stockBefore,
  stockAfter,
  reason,              // optional string e.g. "New shipment received"
  createdBy: req.user.userId
});
```

### Pattern 3: Audit GET Aggregation (extending existing)

**What:** GET /audit currently aggregates from Order and Sale collections separately, then merges and sorts. Restock adds a third aggregation from InventoryAdjustment.

**Key difference:** InventoryAdjustment stores productId as a TOP-LEVEL field (not nested in items array). This means NO `$unwind` is needed — unlike Order/Sale which use `{ $unwind: '$items' }` followed by `{ $match: { 'items.productId': productId } }`.

```javascript
// Source: 01-04-PLAN.md (prescribed extension)
// Note: productId is top-level in InventoryAdjustment, so match directly
const restockAudits = await InventoryAdjustment.aggregate([
  {
    $match: {
      productId: new mongoose.Types.ObjectId(productId),
      // ...dateConditions if present
    }
  },
  {
    $project: {
      timestamp: '$createdAt',
      source: '$type',          // 'restock' or 'correction'
      quantity: '$quantity',
      stockBefore: '$stockBefore',
      stockAfter: '$stockAfter',
      adjustmentId: '$_id',
      variantSku: '$variantSku'
    }
  }
]);

// Merge into combined log
const auditLog = [...orderAudits, ...saleAudits, ...restockAudits]
  .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
```

**Important:** `mongoose` must be required at the top of `inventory.js` for `new mongoose.Types.ObjectId()`. Check whether it is already imported before adding.

### Anti-Patterns to Avoid

- **Direct stock field update in PUT /products/:id:** Already blocked — never circumvent this. All stock changes must go through `/api/inventory` endpoints to maintain audit trail integrity.
- **Creating audit record before atomic update:** Audit should come AFTER the update. Creating it before would leave a dangling audit record if the version conflict fails.
- **Using `$set` instead of `$inc` for stock:** `$inc` is atomic; `$set` based on application-calculated value introduces a race condition window.
- **Skipping version check in restock:** Restock must use the same optimistic locking as deduct — concurrent restocks and deducts on the same variant must not corrupt stock levels.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic inventory updates | Custom mutex/lock logic | MongoDB `findOneAndUpdate` with version match | MongoDB provides document-level atomicity at the operation level |
| Password security | Custom hashing | bcrypt (already installed) | Timing-safe compare, salt handling, cost factor management |
| Token management | Custom session store | jsonwebtoken (already installed) | Stateless, signed, expiry built-in |
| Schema validation | Manual field checks | Mongoose schema validators | min, required, enum already defined on models |

---

## Common Pitfalls

### Pitfall 1: mongoose not imported in inventory.js
**What goes wrong:** `new mongoose.Types.ObjectId(productId)` throws ReferenceError because `mongoose` is not required at the top of `inventory.js`.
**Why it happens:** The current `inventory.js` only imports `Product`, `Order`, `Sale` — it never needed `mongoose` directly until the audit aggregation uses `mongoose.Types.ObjectId`.
**How to avoid:** Add `const mongoose = require('mongoose');` at the top of `inventory.js` alongside the model imports.
**Warning signs:** Module load check passes but runtime error on GET /audit after restock.

### Pitfall 2: Using `$unwind` for InventoryAdjustment aggregation
**What goes wrong:** Adding `{ $unwind: '$items' }` before `$match` on InventoryAdjustment would fail because InventoryAdjustment has no `items` array — fields are top-level.
**Why it happens:** Copy-pasting from Order/Sale aggregation pattern without accounting for schema difference.
**How to avoid:** Match directly on `{ productId: new mongoose.Types.ObjectId(productId) }` — no unwind needed.

### Pitfall 3: Version conflict in restock treated as error when it's just contention
**What goes wrong:** Under high concurrency, a legitimate restock operation returns 409 because a concurrent deduct already incremented the version.
**Why it happens:** Expected behavior — the decision (from CONTEXT.md) is fail-immediately with no retry.
**How to avoid:** Document in the Swagger response that 409 on restock means "retry with current version data," not a permanent failure. The client should re-read the product and retry.

### Pitfall 4: stockAfter can go negative if quantity validation is skipped
**What goes wrong:** A restock with quantity 0 or negative creates a misleading audit record (stockAfter = stockBefore or less).
**How to avoid:** Validate `quantity >= 1` (integer) before the optimistic locking update. Return 400 on invalid quantity.

### Pitfall 5: productId type mismatch in aggregation match
**What goes wrong:** `{ 'items.productId': productId }` (string) does not match ObjectId values stored in MongoDB, returning empty results.
**Why it happens:** Query parameters arrive as strings; MongoDB stores ObjectIds.
**How to avoid:** Convert with `new mongoose.Types.ObjectId(productId)` in all aggregation $match stages. The existing Order/Sale aggregation uses string comparison on `'items.productId'` — verify whether it works in practice. For InventoryAdjustment, use ObjectId conversion explicitly.

---

## Code Examples

### InventoryAdjustment Model (new file to create)
```javascript
// api/models/InventoryAdjustment.js
const mongoose = require('mongoose');

const InventoryAdjustmentSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variantSku: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['restock', 'correction'],
    default: 'restock'
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  stockBefore: {
    type: Number,
    required: true
  },
  stockAfter: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

InventoryAdjustmentSchema.index({ productId: 1 });
InventoryAdjustmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('InventoryAdjustment', InventoryAdjustmentSchema);
```

### Restock Route Response Shape
```javascript
// Success (200)
res.status(200).json({
  success: true,
  stockBefore,
  stockAfter,
  version: updatedVariant.version,
  adjustmentId: auditRecord._id
});
```

### Swagger JSDoc for /restock (follow existing style from /deduct)
```javascript
/**
 * @swagger
 * /api/inventory/restock:
 *   post:
 *     summary: Restock inventory (increase stock)
 *     description: Increase stock for a product variant using optimistic locking. Creates InventoryAdjustment audit record.
 *     tags: [Inventory]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, variantSku, quantity]
 *             properties:
 *               productId:
 *                 type: string
 *               variantSku:
 *                 type: string
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stock increased successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Product or variant not found
 *       409:
 *         description: Version conflict — retry with current data
 *       500:
 *         description: Internal server error
 */
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate Inventory collection for all events | Embedded stockBefore/stockAfter in Order/Sale documents | Decided in Phase 01 | Simpler queries, audit trail is implicit in transaction documents |
| Global product-level version | Per-variant version field | Decided in Phase 01 | Independent concurrent updates to different sizes/colors |

**Decisions made (not revisitable):**
- MongoDB over PostgreSQL: user preference, locked.
- No retry on version conflict: fail-fast strategy, locked.
- No separate Inventory collection: audit trail in Orders/Sales + InventoryAdjustments, locked.

---

## Open Questions

1. **productId type in existing Order/Sale audit aggregation**
   - What we know: The existing GET /audit uses `'items.productId': productId` (string comparison) in the $match. MongoDB stores productId as ObjectId.
   - What's unclear: Whether Mongoose automatically coerces the string in aggregation pipelines. In regular `find()` queries, Mongoose coerces. In raw `aggregate()` pipelines, it may not.
   - Recommendation: When adding InventoryAdjustment aggregation, use `new mongoose.Types.ObjectId(productId)` explicitly. Consider also fixing the Order/Sale match for correctness.

2. **Reserve timeout enforcement**
   - What we know: Reserve endpoint returns `expiresAt` (10 minutes from now) but there is no background job or TTL to auto-release expired reservations.
   - What's unclear: Whether this matters for Phase 01 scope. Phase 01 only requires the API endpoints; actual timer enforcement is a Phase 5/6 concern.
   - Recommendation: Out of scope for plan 01-04. Document as a known limitation for Phase 5 planning.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test files, no test config, no test scripts |
| Config file | None — Wave 0 gap |
| Quick run command | N/A |
| Full suite command | N/A |

No automated test infrastructure exists in this project. The UAT file (`01-UAT.md`) serves as the manual verification record. `package.json` has `"test": "echo \"Error: no test specified\" && exit 1"`.

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INV-01 | GET /api/products returns unified product list | manual-only | N/A — no test infra | N/A |
| INV-02 | Concurrent deduct returns 409 on version conflict | manual-only | N/A — no test infra | N/A |
| INV-03 | POST /restock atomically increases stock | manual-only | Node module load check (see plan 01-04 verify step) | N/A |
| INV-04 | GET /audit returns restock entries alongside sale entries | manual-only | N/A — no test infra | N/A |
| AUTH-02 | Admin password stored as bcrypt hash (never plaintext) | manual-only | N/A — no test infra | N/A |

Manual verification justification: No test framework is installed; adding one is out of scope for this gap-closure plan. The plan 01-04 verification uses `node -e` module load checks as a lightweight smoke test.

### Wave 0 Gaps

- [ ] No test framework installed (jest, vitest, or mocha) — not in scope for plan 01-04
- [ ] No test files exist anywhere under `api/`

*(If tests are desired in future, recommend jest + supertest for Express HTTP endpoint testing)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `api/routes/inventory.js`, `api/models/Product.js`, `api/models/Order.js`, `api/models/Sale.js`, `api/models/Admin.js`, `api/models/Concert.js`, `api/middleware/auth.js`, `api/index.js`
- `.planning/phases/01-foundation-inventory-core/01-04-PLAN.md` — existing plan with prescribed implementation patterns
- `.planning/phases/01-foundation-inventory-core/01-UAT.md` — confirmed gap identification
- `.planning/phases/01-foundation-inventory-core/01-03-SUMMARY.md` — confirmed what was built

### Secondary (MEDIUM confidence)
- `.planning/phases/01-foundation-inventory-core/01-CONTEXT.md` — locked design decisions
- `api/package.json` — confirmed installed dependency versions

### Tertiary (LOW confidence)
- None — all findings are from direct source inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct inspection of installed packages and existing code
- Architecture: HIGH — existing patterns read from source files, gap identified from UAT and plan 01-04
- Pitfalls: HIGH — derived from concrete schema differences (embedded items vs top-level fields) and confirmed decisions (fail-fast on version conflict)

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable stack, no external dependencies changing)

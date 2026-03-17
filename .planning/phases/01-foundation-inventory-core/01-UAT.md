---
status: testing
phase: 01-foundation-inventory-core
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md, 01-06-SUMMARY.md]
started: 2026-03-13T10:30:00Z
updated: 2026-03-13T10:30:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server. From the api/ directory, run `npm start` or `node index.js`. Server boots without errors, connects to MongoDB, and GET http://localhost:5000/health returns a response.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. From the api/ directory, run `npm start` or `node index.js`. Server boots without errors, connects to MongoDB, and GET http://localhost:5000/health returns a response.
result: [pending]

### 2. Admin Login
expected: POST /api/auth/login with `{"username":"admin","password":"admin123!"}` returns a JWT token in the response body (after running `npm run seed:admin` to create the admin user).
result: [pending]

### 3. Token Verification
expected: POST /api/auth/verify with the JWT token from login in the Authorization header (`Bearer <token>`) returns a success response confirming the token is valid.
result: [pending]

### 4. List Products (Public)
expected: GET /api/products returns an array (empty initially). No authentication required.
result: [pending]

### 5. Create Product (Admin)
expected: POST /api/products with a valid JWT token and product JSON body (name, description, basePrice, category, variants array with sku, size, color, stock) creates a product and returns it with an _id and variant details including version fields.
result: [pending]

### 6. Get Single Product
expected: GET /api/products/:id with a valid product ID returns the full product document with embedded variants.
result: [pending]

### 7. Safe PUT Product Update
expected: PUT /api/products/:id with JWT auth and body containing `{ "name": "New Name", "variants": [{ "sku": "existing-sku", "stock": 999, "version": 999, "color": "Red" }] }`. The name updates but stock and version remain unchanged. Only color updates on the variant.
result: [pending]

### 8. Inventory Deduct with Audit Trail
expected: POST /api/inventory/deduct with JWT auth, providing productId, variantSku, quantity, source ("online" or "pos"), and metadata. Stock decrements, response shows stockAfter and auditId. An Order (online) or Sale (pos) document is created.
result: [pending]

### 9. Inventory Restock
expected: POST /api/inventory/restock with JWT auth, providing productId, variantSku, quantity, and optional reason. Stock increases, response shows stockBefore, stockAfter, version, and adjustmentId.
result: [pending]

### 10. Inventory Version Conflict (409)
expected: Deduct stock once, then immediately try to deduct again using the pre-deduct version number. The second request returns 409 Conflict with a version mismatch error message.
result: [pending]

### 11. Inventory Reserve and Release
expected: POST /api/inventory/reserve with productId, variantSku, quantity, reservationId holds stock (decrements it). POST /api/inventory/release with currentVersion returns the reserved stock (increments it). Neither creates Order/Sale audit documents.
result: [pending]

### 12. Inventory Audit Query
expected: GET /api/inventory/audit?productId={id} with JWT auth returns aggregated inventory changes from Order, Sale, and InventoryAdjustment documents, sorted chronologically.
result: [pending]

### 13. Stock Summary
expected: GET /api/inventory/stock with JWT auth returns `{ grandTotal, productCount, products }` where each product has productId, name, category, productTotal, and variants array with sku, size, color, stock for each variant. Only active products are included.
result: [pending]

## Summary

total: 13
passed: 0
issues: 0
pending: 13
skipped: 0

## Gaps

[none yet]

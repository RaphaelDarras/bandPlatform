const mongoose = require('mongoose');

// Variant sub-schema with per-variant version field for optimistic locking
const VariantSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    trim: true
  },
  size: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  version: {
    type: Number,
    default: 0,
    min: 0
  },
  priceAdjustment: {
    type: Number,
    default: 0
  },
  // Shopify variant identity (D-08) — set by the sync so ongoing (post-seed)
  // matching is by Shopify's own IDs, not SKU (Pitfall 5).
  shopifyVariantId: {
    type: String,
    trim: true
  },
  // Shopify inventory-item id (D-08) — the handle used to push/pull stock
  // levels through Shopify's inventory API.
  shopifyInventoryItemId: {
    type: String,
    trim: true
  },
  // Variant-level soft-delete (D-15) — a variant retired on either side is
  // flagged inactive rather than removed, preserving order/audit history.
  active: {
    type: Boolean,
    default: true
  },
  // Confirm-and-retry marker (D-05) — set when a stock write to Shopify is
  // pending confirmation so a follow-up pass can retry it.
  syncPending: {
    type: Boolean,
    default: false
  }
}, { _id: false });

// Product schema with embedded variants
const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  images: [{
    type: String,
    trim: true
  }],
  active: {
    type: Boolean,
    default: true
  },
  // Shopify product identity (D-08) — set by the sync so post-seed matching
  // is by Shopify's own product id, not name/SKU (Pitfall 5).
  shopifyProductId: {
    type: String,
    trim: true
  },
  variants: [VariantSchema]
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Index on variants.sku for fast variant lookups
ProductSchema.index({ 'variants.sku': 1 });

// Index on variants.version to support optimistic locking queries
ProductSchema.index({ 'variants.version': 1 });

// Indexes on Shopify identity fields for fast post-seed sync matching (D-08/Pitfall 5)
ProductSchema.index({ shopifyProductId: 1 });
ProductSchema.index({ 'variants.shopifyVariantId': 1 });

module.exports = mongoose.model('Product', ProductSchema);

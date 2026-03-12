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
  variants: [VariantSchema]
}, {
  timestamps: true
});

// Index on variants.sku for fast variant lookups
ProductSchema.index({ 'variants.sku': 1 });

// Index on variants.version to support optimistic locking queries
ProductSchema.index({ 'variants.version': 1 });

module.exports = mongoose.model('Product', ProductSchema);

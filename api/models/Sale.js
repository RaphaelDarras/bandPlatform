const mongoose = require('mongoose');

// New lines (07.1) carry Shopify GIDs + a snapshot (name, label, SKU, price).
// productId/stockBefore/stockAfter exist only on archived pre-07.1 lines.
// appliedDelta is the net stock delta Shopify actually applied for the line (<= 0).
const SaleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  productGid: { type: String, trim: true },
  variantGid: { type: String, trim: true },
  productName: { type: String, trim: true },
  variantLabel: { type: String, trim: true },
  variantSku: {
    type: String,
    default: ''
  },
  appliedDelta: {
    type: Number,
    max: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  priceAtSale: {
    type: Number,
    required: true
  },
  stockBefore: {
    type: Number
  },
  stockAfter: {
    type: Number
  }
}, { _id: false });

const SaleSchema = new mongoose.Schema({
  concertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Concert',
    required: false
  },
  items: [SaleItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'etransfer', 'paypal', 'split', 'other'],
    default: 'cash'
  },
  paymentSplit: [{
    method: { type: String, enum: ['cash', 'card', 'etransfer', 'paypal'] },
    amount: { type: Number },
  }],
  currency: {
    type: String,
    default: 'EUR'
  },
  discount: {
    type: Number,
    default: 0
  },
  discountType: {
    type: String,
    enum: ['flat', 'percent'],
    default: 'flat'
  },
  voidedAt: {
    type: Date
  },
  voidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  idempotencyKey: {
    type: String
  },
  source: {
    type: String,
    default: 'pos'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Index on concertId for concert-specific queries
SaleSchema.index({ concertId: 1 });

// Index on createdAt (descending) for recent sales
SaleSchema.index({ createdAt: -1 });

// Sparse unique index on idempotencyKey — allows many null values but enforces uniqueness when set
SaleSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Sale', SaleSchema);

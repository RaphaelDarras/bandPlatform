const mongoose = require('mongoose');

const SaleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variantSku: {
    type: String,
    required: true
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
    type: Number,
    required: true
  },
  stockAfter: {
    type: Number,
    required: true
  }
}, { _id: false });

const SaleSchema = new mongoose.Schema({
  concertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Concert',
    required: true
  },
  items: [SaleItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'etransfer', 'paypal', 'other'],
    default: 'cash'
  },
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

const mongoose = require('mongoose');

// Order item sub-schema with inventory audit trail
const OrderItemSchema = new mongoose.Schema({
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
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  priceAtPurchase: {
    type: Number,
    required: true,
    min: 0
  },
  stockBefore: {
    type: Number,
    required: true,
    min: 0
  },
  stockAfter: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

// Order schema
const OrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  customerEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  customerName: {
    type: String,
    trim: true
  },
  items: [OrderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'shipped', 'delivered'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal']
  },
  paymentIntentId: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    default: 'online',
    trim: true
  }
}, {
  timestamps: true
});

// Index on orderNumber for fast lookups
OrderSchema.index({ orderNumber: 1 });

module.exports = mongoose.model('Order', OrderSchema);

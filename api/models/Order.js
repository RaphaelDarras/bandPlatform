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
  // Product name snapshot at time of purchase (CR-01) — never trust a
  // client-recomputed name; the caller (orders.js) populates this from
  // Product.name, mirroring the same never-trust pattern already used for
  // price. Persisted so email.js's renderItemsRows() can show the real
  // product name instead of falling back to the raw variantSku.
  name: {
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

// Shipping address sub-schema (D-04)
const ShippingAddressSchema = new mongoose.Schema({
  addressLine1: {
    type: String,
    required: true,
    trim: true
  },
  addressLine2: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  postalCode: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    required: true,
    trim: true
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
  shippingAddress: {
    type: ShippingAddressSchema,
    required: true
  },
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
  // WR-01 — set by fulfillOrder()'s atomic $set on the paid transition.
  // Without this field declaration, Mongoose's default strict mode
  // silently strips paidAt from that update.
  paidAt: {
    type: Date
  },
  source: {
    type: String,
    default: 'online',
    trim: true
  }
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

// Index on orderNumber for fast lookups
OrderSchema.index({ orderNumber: 1 });

module.exports = mongoose.model('Order', OrderSchema);

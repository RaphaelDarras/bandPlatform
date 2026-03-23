const mongoose = require('mongoose');

// Concert schema for sales attribution
const ConcertSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  country: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  venue: {
    type: String,
    trim: true
  },
  currency: {
    type: String,
    default: 'EUR',
    trim: true
  },
  priceOverrides: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    price: { type: Number, required: true },
  }],
  active: {
    type: Boolean,
    default: true
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

// Index on date (descending) for recent concerts first
ConcertSchema.index({ date: -1 });

module.exports = mongoose.model('Concert', ConcertSchema);

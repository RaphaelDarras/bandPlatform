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
    enum: ['restock', 'correction', 'removal'],
    default: 'restock'
  },
  quantity: {
    type: Number,
    required: true,
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

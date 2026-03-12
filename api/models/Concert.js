const mongoose = require('mongoose');

// Concert schema for sales attribution
const ConcertSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  venue: {
    type: String,
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index on date (descending) for recent concerts first
ConcertSchema.index({ date: -1 });

module.exports = mongoose.model('Concert', ConcertSchema);

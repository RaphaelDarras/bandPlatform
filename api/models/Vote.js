'use strict';

const mongoose = require('mongoose');
const { VOTE_CHOICE_IDS } = require('../utils/voteChoices');

// One tally document per choice (atomic $inc, no per-vote rows, no PII).
const VoteSchema = new mongoose.Schema(
  {
    choice: { type: String, required: true, enum: VOTE_CHOICE_IDS, unique: true },
    count: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vote', VoteSchema);

'use strict';

const express = require('express');
const Vote = require('../models/Vote');
const { VOTE_CHOICE_IDS } = require('../utils/voteChoices');

const router = express.Router();

async function readTally() {
  const docs = await Vote.find({}).lean();
  const counts = {};
  for (const id of VOTE_CHOICE_IDS) counts[id] = 0;
  let total = 0;
  for (const doc of docs) {
    if (VOTE_CHOICE_IDS.includes(doc.choice)) {
      counts[doc.choice] += doc.count;
      total += doc.count;
    }
  }
  return { counts, total };
}

// Public poll: no auth.
router.get('/', async (req, res) => {
  try {
    res.status(200).json(await readTally());
  } catch (error) {
    console.error('Error reading votes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const choice = req.body && req.body.choice;
  // Strict type check blocks operator-object injection.
  if (typeof choice !== 'string' || !VOTE_CHOICE_IDS.includes(choice)) {
    return res.status(400).json({ error: 'Invalid choice' });
  }
  try {
    await Vote.findOneAndUpdate(
      { choice },
      { $inc: { count: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(await readTally());
  } catch (error) {
    console.error('Error casting vote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

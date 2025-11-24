const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Performance = require('../models/Performance');

// Get performance entries for user (last X days)
router.get('/', auth, async (req, res) => {
  try {
      const { days = 14 } = req.query;
          const from = new Date(); from.setDate(from.getDate() - days);
              const entries = await Performance.find({ user: req.user.id, date: { $gte: from } }).sort({ date: 1 });
                  res.json(entries);
                    } catch (err) { res.status(500).send('Server error'); }
                    });

                    module.exports = router;
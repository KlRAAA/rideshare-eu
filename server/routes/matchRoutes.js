const express = require('express');
const router = express.Router();
const { search, create, updateStatus } = require('../controllers/matchController');
const { submitRating } = require('../controllers/ratingController');

router.post('/matches/search', search); // POST, not GET — it carries a filter body
router.post('/matches', create); // "Join" action — creates a PENDING match
router.patch('/matches/:id', updateStatus); // host approves/declines
router.post('/matches/:id/ratings', submitRating);

module.exports = router;

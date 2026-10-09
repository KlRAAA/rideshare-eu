const express = require('express');
const router = express.Router();
const { search, showAll, create, updateStatus, routeOverlap, setLocationSharing } = require('../controllers/matchController');
const { submitRating } = require('../controllers/ratingController');
const { strictBody } = require('../middleware/strictBody');

router.post('/matches/search', strictBody('match.search'), search); // POST, not GET — it carries a filter body
router.post('/matches/show-all', strictBody('match.showAll'), showAll); // empty-state fallback: relaxes route/schedule, keeps destination + safety
router.post('/matches/route-overlap', strictBody('match.routeOverlap'), routeOverlap); // map overlap layer for the Ride Details page
router.post('/matches', strictBody('match.create'), create); // "Join" action — creates a PENDING match
router.patch('/matches/:id', strictBody('match.respond'), updateStatus); // host approves/declines
router.patch('/matches/:id/location-sharing', strictBody('match.locationSharing'), setLocationSharing); // rider: share location with the driver before pickup
router.post('/matches/:id/ratings', strictBody('match.rate'), submitRating);

module.exports = router;

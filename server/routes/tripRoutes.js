const express = require('express');
const router = express.Router();
const { createTrip, listMine, getById, cancelTrip, markCompleted, updateTrip, updateLocation, getLocation } = require('../controllers/tripController');
const { postMessage, listMessages } = require('../controllers/messageController');
const { strictBody } = require('../middleware/strictBody');

router.post('/', strictBody('trip.create'), createTrip);
router.get('/mine', listMine);
router.get('/:id', getById);
router.patch('/:id/cancel', strictBody('trip.cancel'), cancelTrip);
router.patch('/:id', strictBody('trip.update'), updateTrip); // host-only edit
router.post('/:id/complete', strictBody('trip.complete'), markCompleted);
router.post('/:id/location', strictBody('trip.location'), updateLocation); // host-only write, gated on liveLocationSharing
router.get('/:id/location', getLocation); // host + this trip's approved passengers only
router.post('/:id/messages', strictBody('trip.message'), postMessage); // host + this trip's approved passengers, while active
router.get('/:id/messages', listMessages); // same participant + active-trip check as posting

module.exports = router;

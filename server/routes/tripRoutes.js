const express = require('express');
const router = express.Router();
const { createTrip, listMine, getById, cancelTrip, markCompleted, updateTrip, updateLocation, getLocation } = require('../controllers/tripController');
const { postMessage, listMessages } = require('../controllers/messageController');

router.post('/', createTrip);
router.get('/mine', listMine);
router.get('/:id', getById);
router.patch('/:id/cancel', cancelTrip);
router.patch('/:id', updateTrip); // host-only edit
router.post('/:id/complete', markCompleted);
router.post('/:id/location', updateLocation); // host-only write, gated on liveLocationSharing
router.get('/:id/location', getLocation); // host + this trip's approved passengers only
router.post('/:id/messages', postMessage); // host + this trip's approved passengers, while active
router.get('/:id/messages', listMessages); // same participant + active-trip check as posting

module.exports = router;

const express = require('express');
const router = express.Router();
const { createTrip, listMine, getById, cancelTrip, markCompleted, updateTrip } = require('../controllers/tripController');

router.post('/', createTrip);
router.get('/mine', listMine);
router.get('/:id', getById);
router.patch('/:id/cancel', cancelTrip);
router.patch('/:id', updateTrip); // host-only edit
router.post('/:id/complete', markCompleted);

module.exports = router;

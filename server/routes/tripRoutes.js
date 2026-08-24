const express = require('express');
const router = express.Router();
const { createTrip, listMine, getById, cancelTrip, markCompleted } = require('../controllers/tripController');

router.post('/', createTrip);
router.get('/mine', listMine);
router.get('/:id', getById);
router.patch('/:id/cancel', cancelTrip);
router.post('/:id/complete', markCompleted);

module.exports = router;

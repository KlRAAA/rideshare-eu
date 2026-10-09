const express = require('express');
const router = express.Router();
const { list, feed, markRead } = require('../controllers/notificationController');
const { strictBody } = require('../middleware/strictBody');

router.get('/', list);
router.get('/feed', feed); // what's new since the last poll, for pop-ups and the live badge
router.patch('/:id/read', strictBody('alert.markRead'), markRead);

module.exports = router;

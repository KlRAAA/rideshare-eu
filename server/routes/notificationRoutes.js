const express = require('express');
const router = express.Router();
const { list, markRead } = require('../controllers/notificationController');
const { strictBody } = require('../middleware/strictBody');

router.get('/', list);
router.patch('/:id/read', strictBody('alert.markRead'), markRead);

module.exports = router;

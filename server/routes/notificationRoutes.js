const express = require('express');
const router = express.Router();
const { list, markRead } = require('../controllers/notificationController');

router.get('/', list);
router.patch('/:id/read', markRead);

module.exports = router;

const express = require('express');
const router = express.Router();
const { list, markRead, create } = require('../controllers/notificationController');

router.get('/', list);
router.post('/', create);
router.patch('/:id/read', markRead);

module.exports = router;

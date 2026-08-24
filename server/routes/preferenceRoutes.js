const express = require('express');
const router = express.Router();
const { getByUser, upsert } = require('../controllers/preferenceController');

router.get('/:userId', getByUser);
router.patch('/:userId', upsert);

module.exports = router;

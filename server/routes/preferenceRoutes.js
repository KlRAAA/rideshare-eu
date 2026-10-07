const express = require('express');
const router = express.Router();
const { getByUser, upsert } = require('../controllers/preferenceController');
const { strictBody } = require('../middleware/strictBody');

router.get('/:userId', getByUser);
router.patch('/:userId', strictBody('preference.update'), upsert);

module.exports = router;

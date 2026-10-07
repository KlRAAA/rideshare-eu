const express = require('express');
const { active, acknowledge } = require('../controllers/warningController');
const { strictBody } = require('../middleware/strictBody');

const router = express.Router();
router.get('/active', active);
router.patch('/:id/acknowledge', strictBody('warning.acknowledge'), acknowledge);

module.exports = router;

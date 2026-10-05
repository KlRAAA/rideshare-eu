const express = require('express');
const { active, acknowledge } = require('../controllers/warningController');

const router = express.Router();
router.get('/active', active);
router.patch('/:id/acknowledge', acknowledge);

module.exports = router;

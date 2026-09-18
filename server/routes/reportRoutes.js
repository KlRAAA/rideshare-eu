const express = require('express');
const router = express.Router();
const { createReport, getMyReports } = require('../controllers/reportController');

router.get('/mine', getMyReports);
router.post('/', createReport);

module.exports = router;

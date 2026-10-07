const express = require('express');
const router = express.Router();
const { createReport, getMyReports } = require('../controllers/reportController');
const { strictBody } = require('../middleware/strictBody');
const { reportLimiter } = require('../middleware/rateLimit');

router.get('/mine', getMyReports);
router.post('/', reportLimiter(), strictBody('report.create'), createReport);

module.exports = router;

const express = require('express');
const router = express.Router();
const { driverSummary } = require('../services/driverSummaryService');

// The signed-in driver's own rides and fuel share (sub-project H).
router.get('/summary', async (req, res) => {
  const { status, body } = await driverSummary(req.user.id, req.query.period ?? 'month');
  res.status(status).json(body);
});

module.exports = router;

const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');
const { overview, listActions } = require('../controllers/admin/overviewController');
const { setOfficial, history } = require('../controllers/fuelPriceController');

const router = express.Router();
router.use(requireAdmin);

router.get('/overview', overview);
router.get('/actions', listActions);
router.put('/fuel-price', setOfficial);
router.get('/fuel-price/history', history);

module.exports = router;

const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');
const { overview, listActions } = require('../controllers/admin/overviewController');

const router = express.Router();
router.use(requireAdmin);

router.get('/overview', overview);
router.get('/actions', listActions);

module.exports = router;

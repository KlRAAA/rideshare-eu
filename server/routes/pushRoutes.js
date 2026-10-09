const express = require('express');
const router = express.Router();
const { key, subscribe, unsubscribe } = require('../controllers/pushController');
const { strictBody } = require('../middleware/strictBody');

// Web Push (sub-project F): the caller's own phones and browsers.
router.get('/key', key);
router.post('/subscriptions', strictBody('push.subscribe'), subscribe);
router.delete('/subscriptions', strictBody('push.unsubscribe'), unsubscribe);

module.exports = router;

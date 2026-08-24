const express = require('express');
const router = express.Router();
const { getById } = require('../controllers/userController');

router.get('/:id', getById);

module.exports = router;

const express = require('express');
const router = express.Router();
const { createVehicle } = require('../controllers/vehicleController');

router.post('/', createVehicle);

module.exports = router;

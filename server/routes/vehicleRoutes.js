const express = require('express');
const router = express.Router();
const { createVehicle } = require('../controllers/vehicleController');
const { strictBody } = require('../middleware/strictBody');

router.post('/', strictBody('vehicle.create'), createVehicle);

module.exports = router;

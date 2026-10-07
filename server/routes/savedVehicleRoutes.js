const express = require('express');
const { list, create, update, setDefault, remove } = require('../controllers/savedVehicleController');
const { strictBody } = require('../middleware/strictBody');

const router = express.Router();

router.get('/', list);
router.post('/', strictBody('savedVehicle.create'), create);
router.patch('/:id', strictBody('savedVehicle.update'), update);
router.post('/:id/default', strictBody('savedVehicle.setDefault'), setDefault);
router.delete('/:id', strictBody('savedVehicle.remove'), remove);

module.exports = router;

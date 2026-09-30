const express = require('express');
const { list, create, update, setDefault, remove } = require('../controllers/savedVehicleController');

const router = express.Router();

router.get('/', list);
router.post('/', create);
router.patch('/:id', update);
router.post('/:id/default', setDefault);
router.delete('/:id', remove);

module.exports = router;

const prisma = require('../config/db');
const { validateVehicle } = require('../services/vehicleValidation');

async function createVehicle(req, res) {
  const { data, field } = validateVehicle(req.body);
  if (field) return res.status(400).json({ error: 'INVALID_VEHICLE', field });
  // The owner is the verified caller (phase 2), never a client-supplied field.
  const vehicle = await prisma.vehicle.create({ data: { ...data, ownerId: req.user.id } });
  res.status(201).json({ vehicle });
}

module.exports = { createVehicle };

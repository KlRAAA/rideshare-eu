const prisma = require('../config/db');

async function createVehicle(req, res) {
  // The owner is the verified caller (phase 2), never a client-supplied field.
  const { make, model, color, plate, fuelEfficiencyKmL } = req.body;
  const vehicle = await prisma.vehicle.create({
    data: { ownerId: req.user.id, make, model, color, plate, fuelEfficiencyKmL: Number(fuelEfficiencyKmL) },
  });
  res.status(201).json({ vehicle });
}

module.exports = { createVehicle };

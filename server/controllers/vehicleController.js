const prisma = require('../config/db');

async function createVehicle(req, res) {
  const { ownerId, make, model, color, plate, fuelEfficiencyKmL } = req.body;
  const vehicle = await prisma.vehicle.create({
    data: { ownerId, make, model, color, plate, fuelEfficiencyKmL: Number(fuelEfficiencyKmL) },
  });
  res.status(201).json({ vehicle });
}

module.exports = { createVehicle };

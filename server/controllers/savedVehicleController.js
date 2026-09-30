const prisma = require('../config/db');
const { validateVehicle } = require('../services/vehicleValidation');

const MAX_SAVED_VEHICLES = 5;
const LIST_ORDER = [{ isDefault: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];

async function loadOwned(req, res) {
  const vehicle = await prisma.savedVehicle.findUnique({ where: { id: req.params.id } });
  if (!vehicle) {
    res.status(404).json({ error: 'VEHICLE_NOT_FOUND' });
    return null;
  }
  if (vehicle.ownerId !== req.user.id) {
    res.status(403).json({ error: 'NOT_AUTHORIZED' });
    return null;
  }
  return vehicle;
}

async function list(req, res) {
  const vehicles = await prisma.savedVehicle.findMany({ where: { ownerId: req.user.id }, orderBy: LIST_ORDER });
  res.json({ vehicles });
}

async function create(req, res) {
  const { data, field } = validateVehicle(req.body);
  if (field) return res.status(400).json({ error: 'INVALID_VEHICLE', field });

  const count = await prisma.savedVehicle.count({ where: { ownerId: req.user.id } });
  if (count >= MAX_SAVED_VEHICLES) return res.status(409).json({ error: 'SAVED_VEHICLE_LIMIT' });

  const vehicle = await prisma.savedVehicle.create({
    data: { ...data, ownerId: req.user.id, isDefault: count === 0 },
  });
  res.status(201).json({ vehicle });
}

async function update(req, res) {
  const existing = await loadOwned(req, res);
  if (!existing) return;
  const { data, field } = validateVehicle(req.body, { partial: true });
  if (field) return res.status(400).json({ error: 'INVALID_VEHICLE', field });
  const vehicle = await prisma.savedVehicle.update({ where: { id: existing.id }, data });
  res.json({ vehicle });
}

async function setDefault(req, res) {
  const existing = await loadOwned(req, res);
  if (!existing) return;
  await prisma.$transaction([
    prisma.savedVehicle.updateMany({ where: { ownerId: req.user.id }, data: { isDefault: false } }),
    prisma.savedVehicle.update({ where: { id: existing.id }, data: { isDefault: true } }),
  ]);
  res.json({ status: 'DEFAULT_SET' });
}

// Deleting the default promotes the newest remaining car, so a host with any
// saved car always has one pre-selected.
async function remove(req, res) {
  const existing = await loadOwned(req, res);
  if (!existing) return;
  await prisma.$transaction(async (tx) => {
    await tx.savedVehicle.delete({ where: { id: existing.id } });
    if (!existing.isDefault) return;
    const next = await tx.savedVehicle.findFirst({
      where: { ownerId: req.user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (next) await tx.savedVehicle.update({ where: { id: next.id }, data: { isDefault: true } });
  });
  res.json({ status: 'DELETED' });
}

module.exports = { list, create, update, setDefault, remove, MAX_SAVED_VEHICLES };

const prisma = require('../config/db');
const { record } = require('../services/adminActionService');
const { decryptField } = require('../services/encryptionService');
const { getOfficialFuelPrice, isValidFuelPrice } = require('../services/fuelPriceService');

const HISTORY_LIMIT = 50;

async function getOfficial(req, res) {
  const official = await getOfficialFuelPrice();
  res.json({ official: official ? official.pricePerLiter : null, updatedAt: official ? official.updatedAt : null });
}

async function setOfficial(req, res) {
  const raw = req.body?.pricePerLiter;
  const price = typeof raw === 'number' ? raw : Number.NaN;
  if (!isValidFuelPrice(price)) return res.status(400).json({ error: 'INVALID_FUEL_PRICE' });

  const previous = await getOfficialFuelPrice();
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.fuelPrice.create({ data: { pricePerLiter: price, setById: req.user.id } });
    await record(tx, {
      actorId: req.user.id,
      action: 'FUEL_PRICE_SET',
      details: { from: previous ? previous.pricePerLiter : null, to: price },
    });
    return created;
  });
  res.json({ official: row.pricePerLiter, updatedAt: row.createdAt });
}

async function history(req, res) {
  const rows = await prisma.fuelPrice.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: HISTORY_LIMIT,
    include: { setBy: { select: { id: true, fullName: true } } },
  });
  res.json({
    history: rows.map((r) => ({
      id: r.id,
      pricePerLiter: r.pricePerLiter,
      createdAt: r.createdAt,
      setBy: { id: r.setBy.id, fullName: decryptField(r.setBy.fullName) },
    })),
  });
}

module.exports = { getOfficial, setOfficial, history };

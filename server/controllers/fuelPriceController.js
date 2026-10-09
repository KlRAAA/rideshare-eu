const prisma = require('../config/db');
const { record } = require('../services/adminActionService');
const { decryptField } = require('../services/encryptionService');
const { getOfficialFuelPrice, getOfficialFuelPrices, isValidFuelPrice, isValidFuelType } = require('../services/fuelPriceService');
const doe = require('../services/doeFuelService');

const HISTORY_LIMIT = 50;

// All three official prices: { prices: { REGULAR, PREMIUM, DIESEL } }, each
// { pricePerLiter, updatedAt } or null when that type has never been set.
async function getOfficial(req, res) {
  res.json({ prices: await getOfficialFuelPrices() });
}

async function setOfficial(req, res) {
  const fuelType = req.body?.fuelType;
  if (!isValidFuelType(fuelType)) return res.status(400).json({ error: 'INVALID_FUEL_TYPE' });
  const raw = req.body?.pricePerLiter;
  const price = typeof raw === 'number' ? raw : Number.NaN;
  if (!isValidFuelPrice(price)) return res.status(400).json({ error: 'INVALID_FUEL_PRICE' });

  const previous = await getOfficialFuelPrice(fuelType);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.fuelPrice.create({ data: { fuelType, pricePerLiter: price, setById: req.user.id } });
    await record(tx, {
      actorId: req.user.id,
      action: 'FUEL_PRICE_SET',
      details: { fuelType, from: previous ? previous.pricePerLiter : null, to: price },
    });
    return created;
  });
  res.json({ fuelType, official: row.pricePerLiter, updatedAt: row.createdAt });
}

async function history(req, res) {
  const rows = await prisma.fuelPrice.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: HISTORY_LIMIT,
    include: { setBy: { select: { id: true, fullName: true } }, import: { select: { period: true, sourceUrl: true } } },
  });
  res.json({
    history: rows.map((r) => ({
      id: r.id,
      fuelType: r.fuelType,
      pricePerLiter: r.pricePerLiter,
      createdAt: r.createdAt,
      // null when applied automatically from a DOE file (doe: that file)
      setBy: r.setBy ? { id: r.setBy.id, fullName: decryptField(r.setBy.fullName) } : null,
      doe: r.import,
    })),
  });
}

// The latest DOE weekly files read for the official prices.
async function doeImports(req, res) {
  res.json({ imports: await doe.recentImports(), sourcePage: doe.DOE_SOUTH_LUZON_URL });
}

async function checkDoe(req, res) {
  const result = await doe.checkDoeFuelPrices();
  if (result.unreachable) return res.status(502).json({ error: 'DOE_UNREACHABLE' });
  res.json(result);
}

const DECISION_STATUS = { NOT_FOUND: 404, NOT_HELD: 409 };

// Apply or keep current: { import }, 404 NOT_FOUND, or 409 NOT_HELD.
function decide(fn) {
  return async (req, res) => {
    const result = await fn(req.params.id, req.user.id);
    if (result.error) return res.status(DECISION_STATUS[result.error]).json({ error: result.error });
    res.json(result);
  };
}

module.exports = {
  getOfficial,
  setOfficial,
  history,
  doeImports,
  checkDoe,
  applyDoe: decide(doe.applyHeldImport),
  dismissDoe: decide(doe.dismissHeldImport),
};

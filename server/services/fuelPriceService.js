const prisma = require('../config/db');

// Sanity bounds for any fuel price (PHP/L), host-entered or admin-set. Keep in
// sync with src/lib/constants.ts (the client-side copy for inline feedback).
const MIN_FUEL_PRICE_PER_LITER = 20;
const MAX_FUEL_PRICE_PER_LITER = 150;

function isValidFuelPrice(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= MIN_FUEL_PRICE_PER_LITER && n <= MAX_FUEL_PRICE_PER_LITER;
}

// The newest FuelPrice row is the official price; no rows means none is set.
async function getOfficialFuelPrice(client = prisma) {
  const row = await client.fuelPrice.findFirst({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  return row ? { pricePerLiter: row.pricePerLiter, updatedAt: row.createdAt } : null;
}

module.exports = { MIN_FUEL_PRICE_PER_LITER, MAX_FUEL_PRICE_PER_LITER, isValidFuelPrice, getOfficialFuelPrice };

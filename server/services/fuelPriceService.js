const prisma = require('../config/db');

// Sanity bounds for any fuel price (PHP/L), host-entered or admin-set. Keep in
// sync with src/lib/constants.ts (the client-side copy for inline feedback).
const MIN_FUEL_PRICE_PER_LITER = 20;
const MAX_FUEL_PRICE_PER_LITER = 150;

// Pump grades with their own official price (Prisma enum FuelType). Keep in
// sync with src/lib/fuelTypes.ts.
const FUEL_TYPES = ['REGULAR', 'PREMIUM', 'DIESEL'];

function isValidFuelPrice(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= MIN_FUEL_PRICE_PER_LITER && n <= MAX_FUEL_PRICE_PER_LITER;
}

function isValidFuelType(t) {
  return FUEL_TYPES.includes(t);
}

// The newest FuelPrice row of a type is that type's official price; no rows
// means none is set for it.
async function getOfficialFuelPrice(fuelType, client = prisma) {
  const row = await client.fuelPrice.findFirst({
    where: { fuelType },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return row ? { pricePerLiter: row.pricePerLiter, updatedAt: row.createdAt } : null;
}

// { REGULAR: {pricePerLiter, updatedAt} | null, PREMIUM: …, DIESEL: … }
async function getOfficialFuelPrices(client = prisma) {
  const entries = await Promise.all(FUEL_TYPES.map(async (t) => [t, await getOfficialFuelPrice(t, client)]));
  return Object.fromEntries(entries);
}

module.exports = {
  MIN_FUEL_PRICE_PER_LITER,
  MAX_FUEL_PRICE_PER_LITER,
  FUEL_TYPES,
  isValidFuelPrice,
  isValidFuelType,
  getOfficialFuelPrice,
  getOfficialFuelPrices,
};

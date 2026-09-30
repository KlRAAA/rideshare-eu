const MAX_LENGTH = { make: 40, model: 40, color: 30, plate: 15 };
const REQUIRED_TEXT = ['make', 'model', 'color'];
const MIN_FUEL_EFFICIENCY_KM_L = 3;
const MAX_FUEL_EFFICIENCY_KM_L = 50;

// Validates and normalizes car fields. `partial` checks only the fields that
// are present (for edits). Returns { data } or { field } naming the first bad one.
function validateVehicle(input, { partial = false } = {}) {
  const src = input || {};
  const data = {};

  for (const key of REQUIRED_TEXT) {
    if (partial && !(key in src)) continue;
    const value = typeof src[key] === 'string' ? src[key].trim() : '';
    if (!value || value.length > MAX_LENGTH[key]) return { field: key };
    data[key] = value;
  }

  if (!partial || 'plate' in src) {
    const plate = typeof src.plate === 'string' ? src.plate.trim() : '';
    if (plate.length > MAX_LENGTH.plate) return { field: 'plate' };
    data.plate = plate || null;
  }

  if (!partial || 'fuelEfficiencyKmL' in src) {
    const raw = src.fuelEfficiencyKmL;
    const efficiency = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : Number.NaN;
    if (!Number.isFinite(efficiency) || efficiency < MIN_FUEL_EFFICIENCY_KM_L || efficiency > MAX_FUEL_EFFICIENCY_KM_L) {
      return { field: 'fuelEfficiencyKmL' };
    }
    data.fuelEfficiencyKmL = efficiency;
  }

  return { data };
}

module.exports = { validateVehicle, MIN_FUEL_EFFICIENCY_KM_L, MAX_FUEL_EFFICIENCY_KM_L };

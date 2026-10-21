import { DEFAULT_FUEL_TYPE, FUEL_TYPE_SHORT_LABELS, type FuelType } from './fuelTypes';

// Keep in sync with server/services/vehicleValidation.js.
export const MIN_FUEL_EFFICIENCY_KM_L = 3;
export const MAX_FUEL_EFFICIENCY_KM_L = 50;
export const MAX_SAVED_VEHICLES = 5;

export interface SavedVehicle {
  id: string;
  make: string;
  model: string;
  color: string;
  plate: string | null;
  fuelEfficiencyKmL: number;
  fuelType: FuelType;
  isDefault: boolean;
}

export interface VehicleFieldValues {
  make: string;
  model: string;
  color: string;
  plate: string;
  fuelEfficiency: string;
  fuelType: FuelType;
}

export const EMPTY_VEHICLE_FIELDS: VehicleFieldValues = {
  make: '',
  model: '',
  color: '',
  plate: '',
  fuelEfficiency: '',
  fuelType: DEFAULT_FUEL_TYPE,
};

export function vehicleSummary(v: Pick<SavedVehicle, 'make' | 'model' | 'color' | 'plate' | 'fuelEfficiencyKmL' | 'fuelType'>): string {
  return [`${v.make} ${v.model}`, v.color, v.plate, `${v.fuelEfficiencyKmL} km/L`, FUEL_TYPE_SHORT_LABELS[v.fuelType]]
    .filter(Boolean)
    .join(' · ');
}

export function toFieldValues(v: SavedVehicle): VehicleFieldValues {
  return {
    make: v.make,
    model: v.model,
    color: v.color,
    plate: v.plate ?? '',
    fuelEfficiency: String(v.fuelEfficiencyKmL),
    fuelType: v.fuelType ?? DEFAULT_FUEL_TYPE,
  };
}

// The request body for POST/PATCH of a car (saved or per-trip).
export function toVehiclePayload(v: VehicleFieldValues) {
  return {
    make: v.make,
    model: v.model,
    color: v.color,
    plate: v.plate || null,
    fuelEfficiencyKmL: Number(v.fuelEfficiency),
    fuelType: v.fuelType,
  };
}

// Returns a user-facing message, or null when the fields are complete and valid.
export function vehicleFieldsError(v: VehicleFieldValues): string | null {
  return vehicleFieldProblem(v)?.message ?? null;
}

// The first car field that needs fixing, with the suffix of its input id
// (VehicleFields uses `${idPrefix}-${field}`), so the form can point at it.
export function vehicleFieldProblem(v: VehicleFieldValues): { field: 'make' | 'model' | 'color' | 'efficiency'; message: string } | null {
  if (!v.make.trim()) return { field: 'make', message: 'Make is required, like Toyota.' };
  if (!v.model.trim()) return { field: 'model', message: 'Model is required, like Vios.' };
  if (!v.color.trim()) return { field: 'color', message: 'Color is required.' };
  const efficiency = Number(v.fuelEfficiency);
  if (!v.fuelEfficiency.trim() || !Number.isFinite(efficiency) || efficiency < MIN_FUEL_EFFICIENCY_KM_L || efficiency > MAX_FUEL_EFFICIENCY_KM_L) {
    return { field: 'efficiency', message: `Enter a fuel efficiency between ${MIN_FUEL_EFFICIENCY_KM_L} and ${MAX_FUEL_EFFICIENCY_KM_L} km/L.` };
  }
  return null;
}

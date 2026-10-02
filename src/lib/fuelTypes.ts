// Pump grades with their own official price. Keep in sync with
// server/services/fuelPriceService.js (FUEL_TYPES) and the Prisma enum.
export const FUEL_TYPES = ['REGULAR', 'PREMIUM', 'DIESEL'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];
export const DEFAULT_FUEL_TYPE: FuelType = 'REGULAR';

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  REGULAR: 'Regular (Unleaded 91)',
  PREMIUM: 'Premium (95)',
  DIESEL: 'Diesel',
};

export const FUEL_TYPE_SHORT_LABELS: Record<FuelType, string> = {
  REGULAR: 'Regular',
  PREMIUM: 'Premium',
  DIESEL: 'Diesel',
};

export interface OfficialFuelPrice {
  pricePerLiter: number;
  updatedAt: string;
}
export type OfficialFuelPrices = Record<FuelType, OfficialFuelPrice | null>;

export function isFuelType(value: unknown): value is FuelType {
  return typeof value === 'string' && (FUEL_TYPES as readonly string[]).includes(value);
}

// A price older than this gets a reminder on the admin page: Philippine pump
// prices change weekly (DOE advisories take effect on Tuesdays).
export const STALE_PRICE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(iso: string, now: number = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / DAY_MS);
}

// The admin reminder for one fuel type, or null when its price is fresh.
export function stalePriceReminder(fuelType: FuelType, price: OfficialFuelPrice | null, now: number = Date.now()): string | null {
  const name = FUEL_TYPE_SHORT_LABELS[fuelType];
  if (!price) return `No official ${name} price yet. Check the DOE weekly advisory and set one.`;
  const days = daysSince(price.updatedAt, now);
  if (days < STALE_PRICE_DAYS) return null;
  return `${name} price last updated ${days} days ago. Check the DOE weekly advisory.`;
}

// DOE's weekly prevailing retail pump prices by region (Quezon is under South Luzon).
export const DOE_PUMP_PRICES_URL = 'https://doe.gov.ph/data-and-prices/liquid-fuels/retail-pump-prices';

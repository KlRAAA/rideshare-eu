// Compact trip facts for icon + tooltip rows (sub-project I): a short value
// for the row, and the full meaning for the tooltip and screen readers.

export interface Fact {
  short: string;
  long: string;
}

export function seatsFact(total: number, filled: number): Fact {
  const left = Math.max(0, total - filled);
  if (left === 0) return { short: 'Full', long: `All ${total} seats are taken` };
  return { short: `${left} left`, long: `${left} of ${total} seats left, ${filled === 0 ? 'none' : filled} taken` };
}

export function priceFact(fuelShare: number | null | undefined): Fact | null {
  if (fuelShare == null) return null;
  return { short: `₱${fuelShare.toFixed(0)}/seat`, long: 'Fuel share per seat, paid to the driver in person' };
}

export function carFact(vehicle: { make: string; model: string; color: string }): Fact {
  return { short: vehicle.model, long: `${vehicle.make} ${vehicle.model}, ${vehicle.color}` };
}

const RULES: Record<string, Fact> = {
  'Women+ trip': { short: 'Women+', long: 'Women+ trip: only women and non-binary riders can join' },
  'Familiar riders only': { short: 'Familiar', long: 'Familiar riders only: riders who have ridden with this driver before' },
};

export function ruleFact(label: string): Fact {
  return RULES[label] ?? { short: label, long: label };
}

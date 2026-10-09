// The driver's rides and fuel share (sub-project H).

export interface SummaryTotals {
  rides: number;
  riders: number;
  fuelShare: number;
}

export interface DriverSummary {
  period: 'week' | 'month' | 'all';
  totals: SummaryTotals;
  weeks: (SummaryTotals & { weekStart: string })[];
  recent: { tripId: string; destination: string; date: string; riders: number; fuelShare: number; estimated: boolean }[];
}

export function peso(amount: number): string {
  const whole = Number.isInteger(amount);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function weekLabel(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function summaryLine(t: SummaryTotals): string {
  return `${plural(t.rides, 'ride')} · ${plural(t.riders, 'rider')} · ${peso(t.fuelShare)}`;
}

// Bar heights in percent of the busiest week.
export function barHeights(weeks: { rides: number }[]): number[] {
  const max = Math.max(0, ...weeks.map((w) => w.rides));
  return weeks.map((w) => (max === 0 ? 0 : Math.round((w.rides / max) * 100)));
}

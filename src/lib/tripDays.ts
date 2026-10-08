// Trip days on the trip page (sub-project D).

export type DayStatus = 'CONFIRMED' | 'ONGOING' | 'COMPLETED' | 'SKIPPED' | 'NO_SHOW' | null;

export interface TripDay {
  date: string; // YYYY-MM-DD, Philippine time
  departure: string;
  status: DayStatus;
}

// Mirrors server/services/tripCancellationService.js.
export const NO_SHOW_CANCEL_REASON = "The driver didn't start the trip";

const LATE_AFTER_MS = 15 * 60 * 1000;

export function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
}

const STATUS_LABEL: Record<NonNullable<DayStatus>, string> = {
  CONFIRMED: 'Confirmed',
  ONGOING: 'On the way',
  COMPLETED: 'Done',
  SKIPPED: 'Skipped',
  NO_SHOW: 'No-show',
};

export function dayStatusLabel(status: DayStatus): string {
  return status ? STATUS_LABEL[status] : 'Not confirmed';
}

interface Places {
  originAddress: string;
  originLat: number;
  originLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
}

// Find a Ride, filled in with this trip's places and the day's date and time.
export function findAnotherRideHref(trip: Places, departure: string): string {
  const at = new Date(departure);
  const q = new URLSearchParams({
    origin: trip.originAddress,
    olat: trip.originLat.toFixed(6),
    olng: trip.originLng.toFixed(6),
    destination: trip.destinationAddress,
    dlat: trip.destinationLat.toFixed(6),
    dlng: trip.destinationLng.toFixed(6),
    date: at.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
    time: at.toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }),
  });
  return `/auth/search?${q}`;
}

export interface RiderDayLine {
  text: string;
  tone: 'ok' | 'neutral' | 'warn' | 'bad';
  findAnother: boolean;
  departure: string | null;
}

interface RiderView {
  status: string;
  cancelReason: string | null;
  days: TripDay[];
  nextDeparture: { departure: string } | null;
  currentRun: { status: string } | null;
}

// The one line an approved rider sees about the driver's next day.
export function riderDayLine(trip: RiderView, now: Date): RiderDayLine | null {
  if (trip.status === 'CANCELLED') {
    return trip.cancelReason === NO_SHOW_CANCEL_REASON
      ? { text: 'Your driver didn’t start this trip.', tone: 'bad', findAnother: true, departure: null }
      : null;
  }
  if (trip.currentRun?.status === 'ONGOING') return null;
  const startable = trip.nextDeparture?.departure;
  if (startable && new Date(startable) <= now) {
    return now.getTime() - new Date(startable).getTime() >= LATE_AFTER_MS
      ? { text: 'Your driver hasn’t started yet.', tone: 'warn', findAnother: true, departure: startable }
      : null;
  }
  const next = trip.days[0];
  if (!next) return null;
  const label = dayLabel(next.date);
  if (next.status === 'SKIPPED') return { text: `Your driver isn’t driving on ${label}.`, tone: 'warn', findAnother: true, departure: next.departure };
  if (next.status === 'CONFIRMED') return { text: `Your driver confirmed ${label}.`, tone: 'ok', findAnother: false, departure: next.departure };
  return { text: `Not confirmed yet for ${label}.`, tone: 'neutral', findAnother: false, departure: next.departure };
}

const DAY_ERRORS: Record<string, string> = {
  ALREADY_STARTED: 'That day is already confirmed or under way.',
  DAY_SKIPPED: 'That day is skipped. Undo the skip first.',
  DEPARTED: 'That trip has already left.',
  TOO_LATE: 'That trip has already left, so the skip stays.',
  ONE_TIME_TRIP: 'A one-time trip can’t skip a day. Cancel the trip instead.',
  NOT_A_TRIP_DAY: 'The trip doesn’t run that day.',
  NOT_SKIPPED: 'That day isn’t skipped.',
  REASON_TOO_LONG: 'Keep the reason under 200 characters.',
};

export function dayErrorMessage(code: string | undefined): string {
  return (code && DAY_ERRORS[code]) || 'That didn’t work. Refresh the page and try again.';
}

import { formatDate, recurrenceLabel } from '@/lib/format';
import { placeName } from '@/lib/places';

// How a trip is named in lists (Home, My Trips/My Rides, Find a Ride), so
// every screen says it the same way.

export function tripRoute(trip: { originAddress: string; destinationAddress: string }): string {
  return `${placeName(trip.originAddress)} → ${placeName(trip.destinationAddress)}`;
}

// A repeating trip's first date may be past, so it shows how it repeats instead.
export function tripWhen(trip: { departureTime: string; recurrenceType: string }): string {
  if (trip.recurrenceType === 'ONE_TIME') return formatDate(trip.departureTime);
  const label = recurrenceLabel(trip.recurrenceType);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function seatsLeft(trip: { totalSeats: number; filledSeats: number }): string {
  const left = Math.max(0, trip.totalSeats - trip.filledSeats);
  return left === 0 ? 'Full' : `${left} of ${trip.totalSeats} seats left`;
}

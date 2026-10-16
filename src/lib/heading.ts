// Which way the car is facing, for the cone in front of it on the live map.
import { haversineMeters } from '@/lib/geoProximity';

export interface LatLng {
  lat: number;
  lng: number;
}

// Below this the GPS wobble is bigger than the movement, so the last heading stays.
export const MIN_MOVE_M = 8;

// Compass bearing from a to b in degrees, 0 = north, clockwise.
export function bearing(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

export interface HeadingState {
  from: LatLng | null; // where the last heading was measured from
  heading: number | null;
}

// The next heading after a new fix. The phone's own GPS heading wins while
// it has one (it's null when the phone isn't moving); otherwise the direction
// from the last point, once the car has really moved. Standing still keeps
// the last heading, so the cone doesn't spin at a red light.
export function nextHeading(state: HeadingState, here: LatLng, gpsHeading: number | null = null): HeadingState {
  if (gpsHeading != null && Number.isFinite(gpsHeading)) return { from: here, heading: gpsHeading };
  if (!state.from) return { from: here, heading: state.heading };
  if (haversineMeters(state.from, here) < MIN_MOVE_M) return state;
  return { from: here, heading: bearing(state.from, here) };
}

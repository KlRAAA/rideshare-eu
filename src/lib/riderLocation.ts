// Riders' locations for the driver before pickup (sub-project G).
// Mirrors server/services/riderLocationRules.js.

export interface RiderLocation {
  matchId: string;
  passengerId: string;
  fullName: string;
  sharing: boolean;
  location: { lat: number; lng: number } | null;
  updatedAt: string | null;
  metersToPickup: number | null;
  atPickup: boolean;
}

const MIN_MS = 60 * 1000;
const SHARE_BEFORE_MS = 15 * MIN_MS;
const SHARE_UNTIL_MS = 60 * MIN_MS;

function ago(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / MIN_MS);
  return minutes < 1 ? 'just now' : `${minutes} min ago`;
}

function distance(meters: number): string {
  return meters < 1000 ? `${meters} m away` : `${(meters / 1000).toFixed(1)} km away`;
}

export function riderStatusLine(r: RiderLocation, now: Date): string {
  const name = r.fullName.split(' ')[0];
  if (!r.sharing) return `${name} · not sharing`;
  if (!r.location || !r.updatedAt || r.metersToPickup == null) return `${name} · sharing, no position yet`;
  const where = r.atPickup ? 'at the meeting point' : distance(r.metersToPickup);
  return `${name} · ${where} · ${ago(r.updatedAt, now)}`;
}

export type SharingState = { state: 'before'; opensAt: Date } | { state: 'open' } | { state: 'closed' };

export function sharingState(departure: string | null, now: Date): SharingState {
  if (!departure) return { state: 'closed' };
  const dep = new Date(departure).getTime();
  if (now.getTime() < dep - SHARE_BEFORE_MS) return { state: 'before', opensAt: new Date(dep - SHARE_BEFORE_MS) };
  if (now.getTime() <= dep + SHARE_UNTIL_MS) return { state: 'open' };
  return { state: 'closed' };
}

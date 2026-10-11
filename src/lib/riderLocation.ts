// Riders' locations for the driver until pickup (sub-project G, live trip map).
// Mirrors server/services/riderLocationRules.js.
import { clockLabel } from '@/lib/tripRun';

export interface RiderLocation {
  matchId: string;
  passengerId: string;
  fullName: string;
  sharing: boolean;
  pickedUp?: boolean;
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
  if (r.pickedUp) return `${name} · picked up`;
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

// What a rider reads under the map while the trip runs (live trip map).
export interface DriverFeed {
  location: { lat: number; lng: number; updatedAt: string } | null;
  etaAt: string | null;
  pickupEtaAt: string | null;
  pickedUp: boolean;
}

export const PAUSED_AFTER_MS = 45 * 1000;

export function riderTripLine(feed: DriverFeed, now: Date): string {
  if (!feed.location) return 'Waiting for the driver’s location…';
  if (now.getTime() - new Date(feed.location.updatedAt).getTime() > PAUSED_AFTER_MS) {
    return `Driver’s location paused · last seen ${ago(feed.location.updatedAt, now)}`;
  }
  if (feed.pickedUp) return feed.etaAt ? `On the way · arrive about ${clockLabel(feed.etaAt)}` : 'On the way';
  if (!feed.pickupEtaAt) return 'Driver is on the way to the meeting point';
  const minutes = Math.ceil((new Date(feed.pickupEtaAt).getTime() - now.getTime()) / MIN_MS);
  return minutes <= 1 ? 'Driver is almost at the meeting point' : `Driver is about ${minutes} min from the meeting point`;
}

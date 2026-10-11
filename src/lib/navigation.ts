// Turn guidance for the driver while a trip runs (live trip map). Pure: no
// browser or network; the hook in useDriverNavigation feeds it positions.
import type { LatLng } from '@/lib/directions';

export interface NavStep {
  lat: number;
  lng: number;
  type: string; // Mapbox maneuver type: turn, arrive, roundabout, …
  modifier: string | null; // left, slight right, uturn, …
  instruction: string;
  name: string; // the street after the maneuver ('' when unnamed)
}

export interface NavRoute {
  line: LatLng[];
  steps: NavStep[];
  durationSeconds: number;
  distanceMeters: number;
  pickupSeconds: number | null; // first leg, when the pickup is still ahead
}

export type Arrow =
  | 'left'
  | 'right'
  | 'slight-left'
  | 'slight-right'
  | 'sharp-left'
  | 'sharp-right'
  | 'straight'
  | 'uturn'
  | 'roundabout'
  | 'arrive';

export const OFF_ROUTE_M = 50;
const PASSED_M = 10; // a maneuver this close behind the car counts as done
const M_PER_DEG_LAT = 110540;

interface MapboxStep {
  name?: string;
  maneuver: { type: string; modifier?: string; location: [number, number]; instruction: string };
}

export function parseNavRoute(data: unknown, hasPickup: boolean): NavRoute | null {
  const route = (data as { routes?: Array<Record<string, unknown>> } | null)?.routes?.[0] as
    | { distance: number; duration: number; geometry?: { coordinates?: [number, number][] }; legs?: { duration: number; steps: MapboxStep[] }[] }
    | undefined;
  const coords = route?.geometry?.coordinates;
  if (!route || !coords || coords.length < 2) return null;
  const legs = route.legs ?? [];
  return {
    line: coords.map(([lng, lat]) => ({ lat, lng })),
    steps: legs
      .flatMap((l) => l.steps)
      .filter((s) => s.maneuver.type !== 'depart')
      .map((s) => ({
        lat: s.maneuver.location[1],
        lng: s.maneuver.location[0],
        type: s.maneuver.type,
        modifier: s.maneuver.modifier ?? null,
        instruction: s.maneuver.instruction,
        name: s.name ?? '',
      })),
    durationSeconds: Math.round(route.duration),
    distanceMeters: Math.round(route.distance),
    pickupSeconds: hasPickup && legs[0] ? Math.round(legs[0].duration) : null,
  };
}

// Flat-earth projection around p: good to a metre or two at city scale.
function toXY(q: LatLng, p: LatLng) {
  return { x: (q.lng - p.lng) * 111320 * Math.cos((p.lat * Math.PI) / 180), y: (q.lat - p.lat) * M_PER_DEG_LAT };
}

// How far along the line p's nearest point lies, and how far p is from it.
// ponytail: first-nearest segment; a route that doubles back on itself can
// match the wrong pass. Track the last matched segment if that ever shows up.
function project(line: LatLng[], p: LatLng): { along: number; meters: number } {
  let best = { along: 0, meters: Infinity };
  let walked = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = toXY(line[i], p);
    const b = toXY(line[i + 1], p);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / (len * len)));
    const meters = Math.hypot(a.x + t * dx, a.y + t * dy);
    if (meters < best.meters) best = { along: walked + t * len, meters };
    walked += len;
  }
  return best;
}

export function nextManeuver(route: NavRoute, car: LatLng): { step: NavStep; meters: number } | null {
  const carAlong = project(route.line, car).along;
  for (const step of route.steps) {
    const along = project(route.line, step).along;
    if (along > carAlong + PASSED_M) return { step, meters: Math.round(along - carAlong) };
  }
  return null;
}

export function isOffRoute(line: LatLng[], car: LatLng, limitMeters = OFF_ROUTE_M): boolean {
  return project(line, car).meters > limitMeters;
}

export function arrowFor(type: string, modifier: string | null): Arrow {
  if (type === 'arrive') return 'arrive';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return 'roundabout';
  switch (modifier) {
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    case 'slight left':
      return 'slight-left';
    case 'slight right':
      return 'slight-right';
    case 'sharp left':
      return 'sharp-left';
    case 'sharp right':
      return 'sharp-right';
    case 'uturn':
      return 'uturn';
    default:
      return 'straight';
  }
}

export function distanceLabel(meters: number): string {
  if (meters < 50) return `${Math.round(meters)} m`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

const ll = (p: LatLng) => `${p.lat},${p.lng}`;

export function googleMapsUrl(to: LatLng, via: LatLng | null = null): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${ll(to)}${via ? `&waypoints=${ll(via)}` : ''}&travelmode=driving`;
}

export function wazeUrl(to: LatLng): string {
  return `https://waze.com/ul?ll=${ll(to)}&navigate=yes`;
}

// Mapbox Directions API, client-side. The RouteMap component uses this to draw
// the route line, and Post a Ride reuses the same result to persist
// distance/duration on the trip (the server sanity-checks but doesn't re-fetch).
export interface LatLng {
  lat: number;
  lng: number;
}

export interface FetchedRoute {
  waypoints: LatLng[]; // matches Trip.routeWaypoints storage shape
  distanceMeters: number;
  durationSeconds: number;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function hasMapboxToken(): boolean {
  return Boolean(TOKEN);
}

export async function fetchRoute(origin: LatLng, destination: LatLng): Promise<FetchedRoute | null> {
  if (!TOKEN) return null;
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return null;
    return {
      waypoints: route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })),
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
    };
  } catch {
    return null;
  }
}

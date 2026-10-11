'use client';

// The driver's phone while a trip runs (live trip map): follows GPS, keeps a
// traffic-aware route with turn steps, reroutes when off it, and sends the
// position with both ETAs every 10 s. Replaces sub-project B's 30 s loop.
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { fetchNavRoute, type LatLng } from '@/lib/directions';
import { isNearCampus } from '@/lib/geoProximity';
import { isOffRoute, nextManeuver, type NavRoute } from '@/lib/navigation';

const SEND_MS = 10 * 1000;
const REFRESH_MS = 2 * 60 * 1000;
const MIN_REROUTE_GAP_MS = 15 * 1000;
const OFF_ROUTE_FIXES = 2;

interface Options {
  tripId: string;
  active: boolean;
  pickup: LatLng | null; // meeting point while a rider still waits, else null
  destination: LatLng;
  onArrived: () => void;
}

export function useDriverNavigation({ tripId, active, pickup, destination, onArrived }: Options) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [blocked, setBlocked] = useState(false);
  const pos = useRef<LatLng | null>(null);
  const routeRef = useRef<{ route: NavRoute; at: number } | null>(null);
  const lastFetch = useRef(0);
  const offCount = useRef(0);
  const arrived = useRef(false);
  const along = useRef(0);
  const pickupKey = pickup ? `${pickup.lat},${pickup.lng}` : '';

  const reroute = async () => {
    if (!pos.current) return;
    lastFetch.current = Date.now();
    const next = await fetchNavRoute(pos.current, pickup, destination);
    if (!next) return;
    routeRef.current = { route: next, at: Date.now() };
    along.current = 0;
    offCount.current = 0;
    setRoute(next);
  };

  // GPS and the screen wake lock.
  useEffect(() => {
    if (!active || !('geolocation' in navigator)) return;
    let wakeLock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((lock) => {
      if (cancelled) lock.release().catch(() => {});
      else wakeLock = lock;
    }).catch(() => {});
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        pos.current = here;
        setBlocked(false);
        setPosition(here);
      },
      () => setBlocked(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(id);
      wakeLock?.release().catch(() => {});
    };
  }, [active]);

  // First route, off-route reroutes, and a new route when the pickup leg changes.
  useEffect(() => {
    if (!active || !position) return;
    if (!routeRef.current) {
      if (Date.now() - lastFetch.current > MIN_REROUTE_GAP_MS) void reroute();
      return;
    }
    offCount.current = isOffRoute(routeRef.current.route.line, position) ? offCount.current + 1 : 0;
    if (offCount.current >= OFF_ROUTE_FIXES && Date.now() - lastFetch.current > MIN_REROUTE_GAP_MS) void reroute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, position]);

  useEffect(() => {
    if (!active) return;
    routeRef.current = null; // forces a fresh route on the next fix
    void reroute();
    const id = setInterval(() => void reroute(), REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pickupKey]);

  // Position and ETAs to the server every 10 s; near campus ends the run.
  useEffect(() => {
    if (!active) return;
    const send = () => {
      const here = pos.current;
      if (!here) return;
      if (isNearCampus(here) && !arrived.current) {
        arrived.current = true;
        apiFetch(`/api/trips/${tripId}/arrived`, { method: 'POST', body: JSON.stringify({}) })
          .then(onArrived)
          .catch(() => {});
        return;
      }
      const r = routeRef.current;
      const elapsed = r ? Math.round((Date.now() - r.at) / 1000) : 0;
      const body = {
        ...here,
        ...(r && { etaSeconds: Math.max(0, r.route.durationSeconds - elapsed) }),
        ...(r?.route.pickupSeconds != null && { pickupEtaSeconds: Math.max(0, r.route.pickupSeconds - elapsed) }),
      };
      apiFetch(`/api/trips/${tripId}/location`, { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
    };
    const id = setInterval(send, SEND_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tripId]);

  // fromAlong keeps the match on the pass the car is on when a route doubles back.
  const next = useMemo(() => {
    if (!route || !position) return null;
    const found = nextManeuver(route, position, along.current);
    if (found) along.current = found.along;
    return found;
  }, [route, position]);
  return { position, route, next, blocked };
}

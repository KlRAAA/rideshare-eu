'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { RouteMapProps } from './RouteMapView';

// Mapbox GL JS touches `window` at module load, so keep it client-only. Same
// dynamic-import pattern the Leaflet version used before the switch.
const loadRouteMapView = () => import('./RouteMapView');

const RouteMap = dynamic<RouteMapProps>(loadRouteMapView, {
  ssr: false,
  loading: () => (
    <div className="flex w-full h-56 items-center justify-center rounded-2xl border border-gray-300 bg-gray-100 animate-pulse">
      <span className="text-sm text-gray-500">Loading map…</span>
    </div>
  ),
});

// Pages where the map appears only after an address is picked (Find a Ride,
// Post a Trip) start downloading it in the background once the page is idle,
// so it's ready when it's needed (tester feedback: the pickup map was slow).
// Same module promise as the dynamic import above, so it loads once.
// (The connection to Mapbox itself is opened early in layout.tsx.)
export function usePreloadRouteMap() {
  useEffect(() => {
    const start = () => void loadRouteMapView();
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 1000);
    return () => clearTimeout(id);
  }, []);
}

export default RouteMap;
export type { RouteMapProps, OverlapData } from './RouteMapView';
export type { LatLng } from '@/lib/directions';

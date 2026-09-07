'use client';

import dynamic from 'next/dynamic';
import type { RouteMapProps } from './RouteMapView';

// Mapbox GL JS touches `window` at module load, so keep it client-only. Same
// dynamic-import pattern the Leaflet version used before the switch.
const RouteMap = dynamic<RouteMapProps>(() => import('./RouteMapView'), {
  ssr: false,
  loading: () => <div className="w-full h-56 rounded-2xl border border-gray-300 bg-gray-100 animate-pulse" />,
});

export default RouteMap;
export type { RouteMapProps, OverlapData } from './RouteMapView';
export type { LatLng } from '@/lib/directions';

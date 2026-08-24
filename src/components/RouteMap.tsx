'use client';

import dynamic from 'next/dynamic';
import type { RouteMapProps } from './RouteMapImpl';

// Leaflet touches `window` at module-evaluation time, which breaks Next.js's
// server-side render of this "use client" component during the initial HTML
// pass. Loading it only on the client (ssr: false) is the standard fix.
const RouteMap = dynamic<RouteMapProps>(() => import('./RouteMapImpl'), {
  ssr: false,
  loading: () => <div className="w-full h-48 rounded-2xl border border-gray-300 bg-gray-100 animate-pulse" />,
});

export default RouteMap;
export type { RouteMapProps, LatLng } from './RouteMapImpl';

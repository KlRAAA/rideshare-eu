'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icon references image paths that bundlers don't
// resolve correctly; reset to a CDN-hosted default set once per session.
let iconsPatched = false;
function patchDefaultIcon() {
  if (iconsPatched) return;
  iconsPatched = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteMapProps {
  origin?: LatLng | null;
  destination?: LatLng | null;
  waypoints?: LatLng[];
  className?: string;
  heightClassName?: string;
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), { padding: [24, 24] });
  }, [map, points]);
  return null;
}

export default function RouteMap({ origin, destination, waypoints = [], className = '', heightClassName = 'h-48' }: RouteMapProps) {
  patchDefaultIcon();

  const points = [origin, destination].filter((p): p is LatLng => Boolean(p));
  const center = points[0] ?? { lat: 13.9333, lng: 121.6167 }; // Lucena City, MSEUF area fallback

  return (
    <div className={`w-full ${heightClassName} rounded-2xl overflow-hidden border border-gray-300 ${className}`}>
      <MapContainer center={[center.lat, center.lng]} zoom={13} scrollWheelZoom={false} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {origin && <Marker position={[origin.lat, origin.lng]} />}
        {destination && <Marker position={[destination.lat, destination.lng]} />}
        {waypoints.length > 1 && (
          <Polyline
            positions={waypoints.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: '#800000', weight: 4 }}
          />
        )}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}

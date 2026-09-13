'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, Source, Layer, type MapRef } from 'react-map-gl/mapbox';
import type { Feature, FeatureCollection } from 'geojson';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FaHome, FaUniversity, FaMapMarkerAlt, FaCar } from 'react-icons/fa';
import { MSEUF_LUCENA } from '@/lib/constants';
import { fetchRoute, hasMapboxToken, type LatLng } from '@/lib/directions';

const MAROON = '#800000'; // --rsu-color-primary
const SHARED = '#059669'; // emerald-600 — route overlap
const DETOUR = '#d97706'; // amber-600 — off-corridor

export interface OverlapData {
  samples: { lat: number; lng: number; inside: boolean }[];
  fraction: number;
  minRouteOverlap: number;
}

export interface RouteMapProps {
  origin?: LatLng | null;
  destination?: LatLng | null;
  meetingPoint?: LatLng | null;
  // Host road geometry in the Trip.routeWaypoints shape. When omitted but
  // origin + destination are set, the component fetches it from Mapbox itself.
  routeWaypoints?: LatLng[] | null;
  // Passenger straight-line vs host-corridor classification from
  // POST /api/matches/route-overlap. Draws the shared/detour split + legend.
  overlap?: OverlapData | null;
  // Host's live position (liveLocationSharing), polled by the caller — this
  // component only renders it. Deliberately excluded from the bounds-fit
  // calculation below: including a point that moves every ~25-30s would
  // re-center/re-zoom the map on every update, which is jarring for someone
  // just watching a pin approach rather than reviewing a static route.
  driverLocation?: LatLng | null;
  heightClassName?: string;
  className?: string;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function toFC(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

function Pin({ icon, inverted = false }: { icon: React.ReactNode; inverted?: boolean }) {
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md ring-2 ring-white text-xs ${
        inverted ? 'bg-white text-[#800000] ring-[#800000]' : 'bg-[#800000] text-white'
      }`}
    >
      {icon}
    </div>
  );
}

export default function RouteMapView({
  origin,
  destination,
  meetingPoint,
  routeWaypoints,
  overlap,
  driverLocation,
  heightClassName = 'h-56',
  className = '',
}: RouteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [fetchedRoute, setFetchedRoute] = useState<LatLng[] | null>(null);

  const dest = destination ?? MSEUF_LUCENA;

  // Fetch the road line ourselves only when a caller didn't hand us one.
  useEffect(() => {
    if (routeWaypoints?.length || !origin || !dest) {
      setFetchedRoute(null);
      return;
    }
    let cancelled = false;
    fetchRoute(origin, dest).then((r) => {
      if (!cancelled) setFetchedRoute(r?.waypoints ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [origin, dest, routeWaypoints]);

  const roadLine = routeWaypoints?.length ? routeWaypoints : fetchedRoute;

  const roadFC = useMemo<FeatureCollection | null>(() => {
    if (!roadLine || roadLine.length < 2) return null;
    return toFC([
      { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: roadLine.map((p) => [p.lng, p.lat]) } },
    ]);
  }, [roadLine]);

  const { sharedFC, detourFC } = useMemo(() => {
    const s = overlap?.samples ?? [];
    const shared: Feature[] = [];
    const det: Feature[] = [];
    for (let i = 0; i < s.length - 1; i++) {
      const a = s[i];
      const b = s[i + 1];
      const seg: Feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
      };
      (a.inside && b.inside ? shared : det).push(seg);
    }
    return { sharedFC: toFC(shared), detourFC: toFC(det) };
  }, [overlap]);

  const allPoints = useMemo<LatLng[]>(() => {
    const pts: LatLng[] = [];
    if (origin) pts.push(origin);
    pts.push(dest);
    if (meetingPoint) pts.push(meetingPoint);
    if (roadLine) pts.push(...roadLine);
    if (overlap?.samples) pts.push(...overlap.samples);
    return pts;
  }, [origin, dest, meetingPoint, roadLine, overlap]);

  const bounds = useMemo(() => {
    if (allPoints.length === 0) return null;
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const p of allPoints) {
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
    }
    return [
      [minLng, minLat],
      [maxLng, maxLat],
    ] as [[number, number], [number, number]];
  }, [allPoints]);

  const fitToBounds = () => {
    if (bounds) mapRef.current?.fitBounds(bounds, { padding: 36, duration: 0, maxZoom: 15 });
  };
  useEffect(fitToBounds, [bounds]);

  if (!hasMapboxToken()) {
    return (
      <div
        className={`w-full ${heightClassName} rounded-2xl border border-gray-300 bg-gray-50 flex items-center justify-center text-center px-6 ${className}`}
      >
        <p className="text-xs text-gray-400">
          Map unavailable — set <code className="text-gray-500">NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code>.env.local</code>.
        </p>
      </div>
    );
  }

  const center = bounds
    ? { longitude: (bounds[0][0] + bounds[1][0]) / 2, latitude: (bounds[0][1] + bounds[1][1]) / 2 }
    : { longitude: MSEUF_LUCENA.lng, latitude: MSEUF_LUCENA.lat };

  const pct = overlap ? Math.round(overlap.fraction * 100) : null;
  const minPct = overlap ? Math.round(overlap.minRouteOverlap * 100) : null;
  const clears = overlap ? overlap.fraction >= overlap.minRouteOverlap : false;

  return (
    <div className={className}>
      <div className={`w-full ${heightClassName} rounded-2xl overflow-hidden border border-gray-300`}>
        <Map
          ref={mapRef}
          mapboxAccessToken={TOKEN}
          mapStyle="mapbox://styles/mapbox/light-v11"
          initialViewState={{ ...center, zoom: 12 }}
          onLoad={fitToBounds}
          attributionControl={false}
          style={{ width: '100%', height: '100%' }}
        >
          {roadFC && (
            <Source id="road" type="geojson" data={roadFC}>
              <Layer id="road-line" type="line" paint={{ 'line-color': MAROON, 'line-width': 4, 'line-opacity': overlap ? 0.35 : 0.9 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
            </Source>
          )}

          {overlap && (
            <>
              <Source id="detour" type="geojson" data={detourFC}>
                <Layer id="detour-line" type="line" paint={{ 'line-color': DETOUR, 'line-width': 5, 'line-dasharray': [1, 1.5] }} layout={{ 'line-cap': 'round' }} />
              </Source>
              <Source id="shared" type="geojson" data={sharedFC}>
                <Layer id="shared-line" type="line" paint={{ 'line-color': SHARED, 'line-width': 5 }} layout={{ 'line-cap': 'round' }} />
              </Source>
            </>
          )}

          {origin && (
            <Marker longitude={origin.lng} latitude={origin.lat} anchor="center">
              <Pin icon={<FaHome />} />
            </Marker>
          )}
          <Marker longitude={dest.lng} latitude={dest.lat} anchor="center">
            <Pin icon={<FaUniversity />} />
          </Marker>
          {meetingPoint && (
            <Marker longitude={meetingPoint.lng} latitude={meetingPoint.lat} anchor="center">
              <Pin icon={<FaMapMarkerAlt />} inverted />
            </Marker>
          )}
          {driverLocation && (
            <Marker longitude={driverLocation.lng} latitude={driverLocation.lat} anchor="center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shadow-md ring-2 ring-white text-xs bg-blue-600 text-white">
                <FaCar />
              </div>
            </Marker>
          )}
        </Map>
      </div>

      {(overlap || meetingPoint || driverLocation) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: MAROON }} /> Driver’s route
          </span>
          {overlap && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 rounded" style={{ background: SHARED }} /> Shared with your route
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 rounded" style={{ background: DETOUR }} /> Your detour
              </span>
            </>
          )}
          {meetingPoint && (
            <span className="flex items-center gap-1.5">
              <FaMapMarkerAlt className="w-3 h-3 text-[#800000]" /> Meeting point
            </span>
          )}
          {driverLocation && (
            <span className="flex items-center gap-1.5">
              <FaCar className="w-3 h-3 text-blue-600" /> Driver’s live location
            </span>
          )}
        </div>
      )}

      {overlap && (
        <p className="mt-1.5 text-xs text-gray-600">
          <span className="font-semibold text-gray-900">{pct}%</span> of your route overlaps this trip —{' '}
          {clears ? (
            <span className="text-emerald-700">above the {minPct}% minimum to match.</span>
          ) : (
            <span className="text-amber-700">below the {minPct}% minimum, so this trip won’t match you.</span>
          )}
        </p>
      )}
    </div>
  );
}

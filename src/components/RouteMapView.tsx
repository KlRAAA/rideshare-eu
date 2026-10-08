'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, Source, Layer, type MapRef } from 'react-map-gl/mapbox';
import type { Feature, FeatureCollection } from 'geojson';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FaHome, FaUniversity, FaMapMarkerAlt, FaCar, FaExpand, FaTimes } from 'react-icons/fa';
import { MSEUF_LUCENA } from '@/lib/constants';
import { fetchRoute, hasMapboxToken, type LatLng } from '@/lib/directions';
import { inLuzon, OUTSIDE_LUZON_MESSAGE } from '@/lib/serviceArea';

const MAROON = '#800000'; // --rsu-color-primary
const SHARED = '#059669'; // emerald-600 — route overlap
const DETOUR = '#d97706'; // amber-600 — off-corridor
const DRAG_CLICK_GUARD_MS = 500;

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
  // Passing a handler makes that pin draggable. With onMeetingPointChange and
  // no meeting point yet, tapping the map places one.
  onOriginChange?: (point: LatLng) => void;
  onMeetingPointChange?: (point: LatLng) => void;
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
        inverted ? 'bg-[#ffffff] text-[#800000] ring-[#800000]' : 'bg-[#800000] text-white'
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
  onOriginChange,
  onMeetingPointChange,
  heightClassName = 'h-56',
  className = '',
}: RouteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [fetchedRoute, setFetchedRoute] = useState<LatLng[] | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const editable = Boolean(onOriginChange || onMeetingPointChange);
  const canTapToPlaceMeeting = Boolean(onMeetingPointChange && !meetingPoint);
  // Releasing a dragged pin also fires a map click; without this guard the
  // drop point would be taken as "place the meeting point here".
  const lastDragEndRef = useRef(0);
  // Pins must stay in Luzon (lib/serviceArea.ts): a pin dropped outside snaps
  // back to where it was, and a tap outside places nothing.
  const [outsideLuzon, setOutsideLuzon] = useState(false);
  const endDrag =
    (handler: ((p: LatLng) => void) | undefined, previous: LatLng | null | undefined) =>
    (e: { lngLat: { lat: number; lng: number }; target: { setLngLat: (p: [number, number]) => unknown } }) => {
      lastDragEndRef.current = Date.now();
      const point = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      if (!inLuzon(point)) {
        if (previous) e.target.setLngLat([previous.lng, previous.lat]);
        setOutsideLuzon(true);
        return;
      }
      setOutsideLuzon(false);
      handler?.(point);
    };
  const editHint = canTapToPlaceMeeting
    ? 'Drag the home pin to your exact spot. Tap the map to set a meeting point.'
    : onMeetingPointChange
      ? 'Drag the pins to your exact spots.'
      : 'Drag the home pin to your exact spot.';

  // Same map instance in both modes: resize it after the container changes,
  // lock page scroll while it covers the screen, and let Escape close it.
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize(), 0);
    if (!fullScreen) return () => clearTimeout(t);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullScreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [fullScreen]);

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
  // Refit only when something falls outside the current view, so dragging a
  // pin (and the route redrawn after it) doesn't keep zooming the map out
  // while the user is fine-tuning a spot.
  useEffect(() => {
    const view = mapRef.current?.getBounds();
    if (view && allPoints.every((p) => view.contains([p.lng, p.lat]))) return;
    fitToBounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds]);

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
      <div
        className={
          fullScreen
            ? 'fixed inset-0 z-[100] bg-white'
            : `relative w-full ${heightClassName} rounded-2xl overflow-hidden border border-gray-300`
        }
        role={fullScreen ? 'dialog' : undefined}
        aria-modal={fullScreen || undefined}
        aria-label={fullScreen ? 'Map, full screen' : undefined}
      >
        <Map
          ref={mapRef}
          mapboxAccessToken={TOKEN}
          mapStyle="mapbox://styles/mapbox/light-v11"
          initialViewState={{ ...center, zoom: 12 }}
          onLoad={fitToBounds}
          attributionControl={false}
          cursor={canTapToPlaceMeeting ? 'crosshair' : undefined}
          onClick={
            canTapToPlaceMeeting
              ? (e) => {
                  if (Date.now() - lastDragEndRef.current < DRAG_CLICK_GUARD_MS) return;
                  const point = { lat: e.lngLat.lat, lng: e.lngLat.lng };
                  setOutsideLuzon(!inLuzon(point));
                  if (inLuzon(point)) onMeetingPointChange?.(point);
                }
              : undefined
          }
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
            <Marker
              longitude={origin.lng}
              latitude={origin.lat}
              anchor="center"
              draggable={Boolean(onOriginChange)}
              onDragEnd={endDrag(onOriginChange, origin)}
            >
              <Pin icon={<FaHome />} />
            </Marker>
          )}
          <Marker longitude={dest.lng} latitude={dest.lat} anchor="center">
            <Pin icon={<FaUniversity />} />
          </Marker>
          {meetingPoint && (
            <Marker
              longitude={meetingPoint.lng}
              latitude={meetingPoint.lat}
              anchor="center"
              draggable={Boolean(onMeetingPointChange)}
              onDragEnd={endDrag(onMeetingPointChange, meetingPoint)}
            >
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

        <button
          type="button"
          onClick={() => setFullScreen((v) => !v)}
          aria-label={fullScreen ? 'Close full-screen map' : 'Open map full screen'}
          className="absolute right-2 flex items-center gap-1.5 rounded-full bg-white/95 text-[#1f2937] shadow-md px-3 py-1.5 text-xs font-semibold hover:bg-[#ffffff]"
          style={{ top: fullScreen ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : '8px' }}
        >
          {fullScreen ? (
            <>
              <FaTimes className="w-3 h-3" aria-hidden /> Done
            </>
          ) : (
            <>
              <FaExpand className="w-3 h-3" aria-hidden /> Full screen
            </>
          )}
        </button>

        {editable && fullScreen && (
          <p
            className="absolute left-2 right-2 rounded-lg bg-white/95 text-[#374151] shadow px-2.5 py-1.5 text-xs leading-snug pointer-events-none"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
          >
            {outsideLuzon ? OUTSIDE_LUZON_MESSAGE : editHint}
          </p>
        )}
      </div>

      {editable && !fullScreen && <p className="mt-1.5 text-[11px] text-gray-500">{editHint}</p>}
      {outsideLuzon && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {OUTSIDE_LUZON_MESSAGE}
        </p>
      )}

      {(overlap || meetingPoint || driverLocation) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 rounded bg-[#800000]" /> Driver’s route
          </span>
          {overlap && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 rounded bg-[#059669]" /> Shared with your route
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 rounded bg-[#d97706]" /> Your detour
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

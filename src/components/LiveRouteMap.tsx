'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import RouteMap from './RouteMap';
import { apiFetch } from '@/lib/api';
import { riderTripLine, type DriverFeed } from '@/lib/riderLocation';
import { nextHeading, type HeadingState } from '@/lib/heading';

// Riders poll as often as the driver's phone sends (every 10 s).
const DRIVER_POLL_MS = 10 * 1000;
// Advances "now" so "paused" and "last seen" keep moving even when polls fail.
const CLOCK_TICK_MS = 5 * 1000;

interface LatLng {
  lat: number;
  lng: number;
}

interface LiveRouteMapProps {
  tripId: string;
  origin: LatLng;
  destination: LatLng;
  meetingPoint: LatLng | null;
  routeWaypoints: LatLng[] | null;
  // Precomputed by the caller (passenger side, APPROVED match, active trip) —
  // this component only needs to know whether to poll, not why.
  canWatchDriverLocation: boolean;
  // Riders not yet picked up, for the driver (sub-project G, live trip map).
  riderLocations?: (LatLng & { label: string })[];
  // The driver's own position from their phone; drawn as the car, no polling.
  ownLocation?: LatLng | null;
  // Which way the driver's own car faces (from their GPS).
  ownHeading?: number | null;
  // The live ETA the driver's phone last sent (null when there's none).
  onEta?: (etaAt: string | null) => void;
  // Whether the driver marked this rider picked up (rider side).
  onPickedUp?: (pickedUp: boolean) => void;
}

// Owns the driver location poll and its 10 s interval so that tick only
// re-renders this component + RouteMap, not the whole trip detail page.
// Extracted from TripDetailClient, where this same state used to live at the
// top level: every poll tick re-rendered the entire page — DriverIdentityCard,
// TripSummaryCard, CoRidersCard (whose renderActions prop is a fairly heavy
// inline closure), ChatCard, all of it — for a value only RouteMap actually
// reads.
export default function LiveRouteMap({
  tripId,
  origin,
  destination,
  meetingPoint,
  routeWaypoints,
  canWatchDriverLocation,
  riderLocations,
  ownLocation,
  ownHeading = null,
  onEta,
  onPickedUp,
}: LiveRouteMapProps) {
  const [feed, setFeed] = useState<DriverFeed | null>(null);
  const [now, setNow] = useState(() => new Date());
  // A rider's page works out the heading from the driver's last two points.
  const feedHeading = useRef<HeadingState>({ from: null, heading: null });

  useEffect(() => {
    if (!canWatchDriverLocation) {
      setFeed(null);
      return;
    }
    let cancelled = false;
    const poll = () => {
      apiFetch<DriverFeed>(`/api/trips/${tripId}/location`)
        .then((data) => {
          if (cancelled) return;
          if (data.location) feedHeading.current = nextHeading(feedHeading.current, data.location);
          setFeed(data);
          setNow(new Date());
          onEta?.(data.etaAt ?? null);
          onPickedUp?.(data.pickedUp);
        })
        .catch(() => {});
    };
    poll();
    const intervalId = setInterval(poll, DRIVER_POLL_MS);
    // So "paused" and "last seen" advance even when polls fail.
    const tickId = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      clearInterval(tickId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, canWatchDriverLocation]);

  const car = ownLocation ?? (feed?.location ? { lat: feed.location.lat, lng: feed.location.lng } : null);
  const heading = ownLocation ? ownHeading : feedHeading.current.heading;
  // While the car moves, follow it: the driver sees their own car up close; a
  // rider sees the car and where they'll be picked up (just the car after pickup).
  // Keyed on the coordinates, so the 5 s clock tick doesn't move the camera.
  const pickupPoint = meetingPoint ?? origin;
  const carOnly = Boolean(ownLocation || feed?.pickedUp);
  const followKey = car ? `${car.lat},${car.lng},${carOnly},${pickupPoint.lat},${pickupPoint.lng}` : '';
  const follow = useMemo(
    () => (!car ? null : carOnly ? [car] : [car, pickupPoint]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [followKey]
  );
  return (
    <div className="space-y-2">
      <RouteMap
        origin={origin}
        destination={destination}
        meetingPoint={meetingPoint}
        routeWaypoints={routeWaypoints}
        driverLocation={car}
        driverHeading={heading}
        follow={follow}
        riderLocations={riderLocations}
      />
      {canWatchDriverLocation && feed && (
        <p role="status" className="rsu-card py-2 text-sm font-semibold text-gray-900">
          {riderTripLine(feed, now)}
        </p>
      )}
    </div>
  );
}

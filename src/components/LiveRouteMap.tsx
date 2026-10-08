'use client';

import React, { useEffect, useState } from 'react';
import RouteMap from './RouteMap';
import { apiFetch } from '@/lib/api';
import { LOCATION_POLL_INTERVAL_MS } from '@/lib/constants';

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
  // The live ETA the driver's phone last sent (null when there's none).
  onEta?: (etaAt: string | null) => void;
}

// Owns the driverLocation poll and its ~30s interval so that tick only
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
  onEta,
}: LiveRouteMapProps) {
  const [driverLocation, setDriverLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!canWatchDriverLocation) {
      setDriverLocation(null);
      return;
    }
    let cancelled = false;
    const poll = () => {
      apiFetch<{ location: { lat: number; lng: number; updatedAt: string } | null; etaAt?: string | null }>(
        `/api/trips/${tripId}/location`
      )
        .then((data) => {
          if (cancelled) return;
          setDriverLocation(data.location ? { lat: data.location.lat, lng: data.location.lng } : null);
          onEta?.(data.etaAt ?? null);
        })
        .catch(() => {
          if (!cancelled) setDriverLocation(null);
        });
    };
    poll();
    const intervalId = setInterval(poll, LOCATION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [tripId, canWatchDriverLocation]);

  return (
    <RouteMap
      origin={origin}
      destination={destination}
      meetingPoint={meetingPoint}
      routeWaypoints={routeWaypoints}
      driverLocation={driverLocation}
    />
  );
}

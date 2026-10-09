'use client';

import React, { useEffect, useState } from 'react';
import { FaUsers } from 'react-icons/fa';
import { apiFetch } from '@/lib/api';
import { LOCATION_POLL_INTERVAL_MS } from '@/lib/constants';
import { riderStatusLine, sharingState, type RiderLocation } from '@/lib/riderLocation';

interface RidersNearbyCardProps {
  tripId: string;
  departure: string | null;
  // Sharing riders' positions, for the map.
  onRiders: (riders: RiderLocation[]) => void;
}

// The driver's view of approved riders before pickup (sub-project G).
export default function RidersNearbyCard({ tripId, departure, onRiders }: RidersNearbyCardProps) {
  const [riders, setRiders] = useState<RiderLocation[] | null>(null);
  const [now, setNow] = useState(() => new Date());
  const open = sharingState(departure, now).state === 'open';

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiFetch<{ riders: RiderLocation[] }>(`/api/trips/${tripId}/rider-locations`);
        if (cancelled) return;
        setRiders(data.riders);
        setNow(new Date());
        onRiders(data.riders);
      } catch {
        /* try again next tick */
      }
    };
    void load();
    const id = setInterval(load, LOCATION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, tripId, onRiders]);

  // Keeps checking whether the window has opened.
  useEffect(() => {
    if (open) return;
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!open || !riders || riders.length === 0) return null;
  return (
    <section aria-label="Riders before pickup" className="rsu-card space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
        <FaUsers className="h-4 w-4 text-[color:var(--rsu-color-primary)]" aria-hidden />
        Riders before pickup
      </h2>
      <ul className="space-y-1 text-sm text-gray-800">
        {riders.map((r) => (
          <li key={r.matchId} className={r.atPickup ? 'font-semibold text-gray-900' : undefined}>
            {riderStatusLine(r, now)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">Riders who turned sharing on appear on the map. Their positions are erased when you start the trip.</p>
    </section>
  );
}

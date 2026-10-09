'use client';

import React, { useEffect, useState } from 'react';
import { FaLocationArrow } from 'react-icons/fa';
import { apiFetch } from '@/lib/api';
import { getCurrentCoords } from '@/lib/geoProximity';
import { LOCATION_POLL_INTERVAL_MS } from '@/lib/constants';
import { clockLabel } from '@/lib/tripRun';
import { sharingState } from '@/lib/riderLocation';

interface RiderLocationCardProps {
  tripId: string;
  matchId: string;
  initialOn: boolean;
  // The next departure that can still be started (B), or null.
  departure: string | null;
}

const TICK_MS = 30 * 1000;

// The rider's "share my location with the driver" switch (sub-project G).
// While on and inside the window, this page sends the position every 30 s.
export default function RiderLocationCard({ tripId, matchId, initialOn, departure }: RiderLocationCardProps) {
  const [on, setOn] = useState(initialOn);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [blocked, setBlocked] = useState(false);
  const share = sharingState(departure, now);
  const open = share.state === 'open';

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!on || !open) return;
    let cancelled = false;
    const send = async () => {
      const coords = await getCurrentCoords({ timeout: 10000, maximumAge: 15000 });
      if (cancelled) return;
      setBlocked(!coords);
      if (!coords) return;
      apiFetch(`/api/trips/${tripId}/rider-location`, { method: 'POST', body: JSON.stringify(coords) }).catch(() => {});
    };
    void send();
    const id = setInterval(send, LOCATION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [on, open, tripId]);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      const res = await apiFetch<{ sharesLocation: boolean }>(`/api/matches/${matchId}/location-sharing`, {
        method: 'PATCH',
        body: JSON.stringify({ on: next }),
      });
      setOn(res.sharesLocation);
    } catch {
      /* keep the old state */
    } finally {
      setBusy(false);
    }
  }

  let status = 'Off. Your driver can’t see where you are.';
  if (on && open) status = blocked ? 'Allow location for this site so your driver can see you.' : 'Sharing with your driver now. Keep this page open.';
  else if (on && share.state === 'before') status = `Starts at ${clockLabel(share.opensAt)}. Keep this page open then.`;
  else if (on) status = 'On for your next pickup.';

  return (
    <section aria-label="Share my location" className="rsu-card space-y-2">
      <label className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <FaLocationArrow className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
          Share my location with the driver before pickup
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={on}
          disabled={busy}
          onChange={(e) => toggle(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-emerald-700"
        />
      </label>
      <p className="text-sm text-gray-600" role="status">
        {status}
      </p>
      <p className="text-xs text-gray-500">
        Only your driver sees it, from 15 minutes before departure until the trip starts. Only your latest position is kept,
        and it’s erased when the trip starts.
      </p>
    </section>
  );
}

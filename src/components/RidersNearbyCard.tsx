'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FaUsers } from 'react-icons/fa';
import { apiFetch } from '@/lib/api';
import { LOCATION_POLL_INTERVAL_MS } from '@/lib/constants';
import { riderStatusLine, sharingState, type RiderLocation } from '@/lib/riderLocation';

interface RidersNearbyCardProps {
  tripId: string;
  departure: string | null;
  runOngoing: boolean;
  // Sharing riders' positions, for the map.
  onRiders: (riders: RiderLocation[]) => void;
}

// The driver's view of approved riders before pickup (sub-project G).
export default function RidersNearbyCard({ tripId, departure, runOngoing, onRiders }: RidersNearbyCardProps) {
  const [riders, setRiders] = useState<RiderLocation[] | null>(null);
  const [now, setNow] = useState(() => new Date());
  const open = runOngoing || sharingState(departure, now).state === 'open';
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ riders: RiderLocation[] }>(`/api/trips/${tripId}/rider-locations`);
      setRiders(data.riders);
      setNow(new Date());
      onRiders(data.riders);
    } catch {
      /* try again next tick */
    }
  }, [tripId, onRiders]);

  useEffect(() => {
    if (!open) return;
    void load();
    const id = setInterval(load, LOCATION_POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      onRiders([]); // the run ended or the window closed: the map drops the pins
    };
  }, [open, load, onRiders]);

  async function setPickedUp(matchId: string, pickedUp: boolean) {
    setBusy(matchId);
    setError(null);
    try {
      await apiFetch(`/api/matches/${matchId}/picked-up`, { method: pickedUp ? 'POST' : 'DELETE', body: '{}' });
      await load();
    } catch {
      setError('Couldn’t update that rider. Try again.');
    } finally {
      setBusy(null);
    }
  }

  // Keeps checking whether the window has opened.
  useEffect(() => {
    if (open) return;
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!open || !riders || riders.length === 0) return null;
  return (
    <section aria-label={runOngoing ? 'Riders to pick up' : 'Riders before pickup'} className="rsu-card space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
        <FaUsers className="h-4 w-4 text-[color:var(--rsu-color-primary)]" aria-hidden />
        {runOngoing ? 'Riders to pick up' : 'Riders before pickup'}
      </h2>
      <ul className="space-y-2 text-sm text-gray-800">
        {riders.map((r) => {
          const firstName = r.fullName.split(' ')[0];
          return (
            <li key={r.matchId} className="flex items-center justify-between gap-3">
              <span className={r.atPickup && !r.pickedUp ? 'font-semibold text-gray-900' : undefined}>{riderStatusLine(r, now)}</span>
              {runOngoing && (
                <button
                  type="button"
                  disabled={busy === r.matchId}
                  onClick={() => setPickedUp(r.matchId, !r.pickedUp)}
                  aria-label={r.pickedUp ? `Undo pickup for ${firstName}` : `Mark ${firstName} picked up`}
                  className={`${r.pickedUp ? 'rsu-btn-secondary' : 'rsu-btn-primary'} shrink-0 px-3 py-1.5 text-xs disabled:opacity-60`}
                >
                  {r.pickedUp ? 'Undo' : 'Picked up'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">
        Riders who turned sharing on appear on the map until you mark them picked up. Their positions are erased then, and when the trip ends.
      </p>
    </section>
  );
}

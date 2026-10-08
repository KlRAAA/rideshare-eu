'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlay, FaFlagCheckered, FaRoute } from 'react-icons/fa';
import { apiFetch, ApiError } from '@/lib/api';
import { clockLabel, elapsedLabel } from '@/lib/tripRun';

export interface CurrentRun {
  status: 'ONGOING' | 'COMPLETED';
  startedAt: string;
  plannedArrivalAt: string;
  etaAt: string | null;
}

export interface NextDeparture {
  departure: string;
  opensAt: string;
  closesAt: string;
  plannedArrivalAt: string;
}

interface TripRunPanelProps {
  tripId: string;
  isHost: boolean;
  currentRun: CurrentRun | null;
  nextDeparture: NextDeparture | null;
  // The newest ETA from the driver's phone, polled with the map (riders).
  liveEtaAt?: string | null;
}

const TICK_MS = 30 * 1000;

// Start Trip / trip in progress / End Trip (sub-project B). The server decides
// what is allowed; this shows the state it reports and refreshes after a change.
export default function TripRunPanel({ tripId, isHost, currentRun, nextDeparture, liveEtaAt = null }: TripRunPanelProps) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ongoing = currentRun?.status === 'ONGOING';

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  async function act(path: 'start' | 'end') {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/${path}`, { method: 'POST', body: JSON.stringify({}) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t reach the server. Try again in a moment.');
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  if (ongoing && currentRun) {
    const arrival = liveEtaAt ?? currentRun.etaAt ?? currentRun.plannedArrivalAt;
    return (
      <section
        aria-label="Trip in progress"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2 text-emerald-900"
      >
        <p className="flex items-center gap-2 text-sm font-bold">
          <FaRoute className="w-4 h-4" aria-hidden />
          Trip in progress · {elapsedLabel(currentRun.startedAt, now)}
        </p>
        <p className="text-sm">Arrive about {clockLabel(arrival)}</p>
        {isHost && (
          <>
            <p className="text-xs text-emerald-800">Keep this page open so your riders can see where you are.</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('End this trip? Riders will be asked to rate it.')) act('end');
              }}
              className="rsu-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <FaFlagCheckered className="w-3.5 h-3.5" aria-hidden />
              {busy ? 'Ending…' : 'End Trip'}
            </button>
          </>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </section>
    );
  }

  if (!nextDeparture) return null;
  const windowOpen = now >= new Date(nextDeparture.opensAt) && now <= new Date(nextDeparture.closesAt);

  if (!isHost) {
    return <p className="text-sm text-gray-600">Arrives about {clockLabel(nextDeparture.plannedArrivalAt)}</p>;
  }
  if (!windowOpen) {
    return (
      <p className="text-sm text-gray-600">
        You can start this trip from {clockLabel(nextDeparture.opensAt)}
        {new Date(nextDeparture.opensAt).toDateString() !== now.toDateString() &&
          ` on ${new Date(nextDeparture.opensAt).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' })}`}
        .
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => act('start')}
        className="rsu-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <FaPlay className="w-3.5 h-3.5" aria-hidden />
        {busy ? 'Starting…' : 'Start Trip'}
      </button>
      <p className="text-xs text-gray-500">Your approved riders are told, and they can follow your location until you end the trip.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

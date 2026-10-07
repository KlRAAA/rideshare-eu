'use client';

import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { apiFetch, ApiError } from '@/lib/api';
import { needsOpenTripWarning, type GenderPreference } from '@/lib/riderRules';
import OpenTripWarning from './OpenTripWarning';

// PSGA scores from the search result. The fuel share is NOT here — the server
// snapshots it from the trip's persisted per-seat value, never from the client.
export interface JoinMatchPayload {
  score: number;
  routeOverlap: number;
  scheduleAlignment: number;
  preferenceMatch: boolean;
}

interface RequestToJoinModalProps {
  tripId: string;
  passengerId: string;
  hostName: string;
  matchPayload: JoinMatchPayload;
  // The trip's "who can join" rule and the rider's own choice (search filter
  // or Profile), for the warning before joining a trip open to everyone.
  tripGenderPreference: string;
  riderPreference: GenderPreference;
  onClose: () => void;
  onSubmitted: () => void;
}

const ERROR_COPY: Record<string, string> = {
  TRIP_FULL: 'This ride just filled up. Try another match.',
  ALREADY_REQUESTED: 'You’ve already requested to join this ride.',
  TRIP_NOT_OPEN: 'This ride is no longer accepting requests.',
  CANNOT_JOIN_OWN_TRIP: 'This is your own ride.',
  TRIP_WOMEN_PLUS_ONLY: 'This trip is for women and non-binary riders only.',
  TRIP_FAMILIAR_RIDERS_ONLY: 'This driver only takes riders they’ve ridden with before.',
};

export default function RequestToJoinModal({
  tripId,
  passengerId,
  hostName,
  matchPayload,
  tripGenderPreference,
  riderPreference,
  onClose,
  onSubmitted,
}: RequestToJoinModalProps) {
  const [warningAccepted, setWarningAccepted] = useState(false);
  const showWarning = !warningAccepted && needsOpenTripWarning(tripGenderPreference, riderPreference);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/matches', {
        method: 'POST',
        body: JSON.stringify({
          tripId,
          ...matchPayload,
          message: message.trim() || undefined,
        }),
      });
      onSubmitted();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError((code && ERROR_COPY[code]) || 'Couldn’t send that request. Try again in a moment.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="rsu-card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Request to join</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <FaTimes className="w-4 h-4" />
          </button>
        </div>
        {showWarning ? (
          <OpenTripWarning onCancel={onClose} onContinue={() => setWarningAccepted(true)} />
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">{hostName} reviews every request and approves riders manually.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="join-message" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Message to driver (optional)
                </label>
                <textarea
                  id="join-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Where you'd like to be picked up, anything the driver should know…"
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button type="submit" disabled={loading} className="rsu-btn-primary w-full disabled:opacity-60">
                {loading ? 'Sending…' : 'Send request'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

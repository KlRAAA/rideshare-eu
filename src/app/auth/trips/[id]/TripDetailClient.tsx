'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaFlag, FaBan } from 'react-icons/fa';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import RouteMap from '@/components/RouteMap';
import RatingModal from '@/components/RatingModal';
import CancelTripModal from '@/components/CancelTripModal';
import { apiFetch } from '@/lib/api';
import { formatDate, formatTime, recurrenceLabel, roleLabel } from '@/lib/format';
import { tripStatusBadge, matchStatusBadge } from '@/lib/statusBadge';
import { checkCampusProximity } from '@/lib/geoProximity';

interface Vehicle {
  make: string;
  model: string;
  color: string;
  plate?: string | null;
}

interface SafeUser {
  id: string;
  fullName: string;
  role: string;
  trustScore: number;
}

interface MatchInfo {
  id: string;
  passengerId: string;
  status: string;
  fuelShareAmount: number;
  passenger: SafeUser;
}

export interface TripDetail {
  id: string;
  originAddress: string;
  originLat: number;
  originLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  departureTime: string;
  recurrenceType: string;
  totalSeats: number;
  filledSeats: number;
  vehicle: Vehicle;
  status: string;
  fuelShareSuggested: number | null;
  driverNotes: string | null;
  genderPreference: string;
  flexibleDeparture: boolean;
  flexWindowMinutes: number;
  familiarRidersOnly: boolean;
  host: SafeUser;
  matches: MatchInfo[];
}

interface TripDetailClientProps {
  trip: TripDetail;
  currentUserId: string;
  liveLocationSharing?: boolean;
}

export default function TripDetailClient({ trip, currentUserId, liveLocationSharing = false }: TripDetailClientProps) {
  const router = useRouter();
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [rating, setRating] = useState<{ matchId: string; rateeId: string; rateeName: string } | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [completing, setCompleting] = useState(false);

  const isHost = trip.host.id === currentUserId;
  const myMatch = trip.matches.find((m) => m.passengerId === currentUserId);
  const myActiveMatch = myMatch && (myMatch.status === 'PENDING' || myMatch.status === 'APPROVED') ? myMatch : null;
  const status = tripStatusBadge(trip.status);

  const tripIsActive = trip.status === 'OPEN' || trip.status === 'FULL';
  const canCancel = (isHost && tripIsActive) || (!isHost && Boolean(myActiveMatch));

  // Optional nice-to-have (Task 13, item 3): a single opportunistic
  // proximity check on mount, only for the host (the manual-complete
  // endpoint this reuses is host-only server-side, matching "the person
  // driving" as the meaningful signal), only while opted in, only while
  // the trip is still active. Never blocks anything — checkCampusProximity
  // resolves null on any failure and this effect just no-ops on null.
  useEffect(() => {
    if (!isHost || !liveLocationSharing || !tripIsActive) return;
    let cancelled = false;
    checkCampusProximity().then((isNearCampus) => {
      if (!cancelled && isNearCampus) {
        apiFetch(`/api/trips/${trip.id}/complete`, { method: 'POST', body: JSON.stringify({ userId: currentUserId }) }).then(
          () => router.refresh()
        );
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, isHost, liveLocationSharing, tripIsActive]);

  async function respond(matchId: string, action: 'APPROVED' | 'DECLINED') {
    setBusyMatchId(matchId);
    try {
      await apiFetch(`/api/matches/${matchId}`, { method: 'PATCH', body: JSON.stringify({ status: action }) });
      router.refresh();
    } finally {
      setBusyMatchId(null);
    }
  }

  async function markCompleted() {
    setCompleting(true);
    try {
      await apiFetch(`/api/trips/${trip.id}/complete`, { method: 'POST', body: JSON.stringify({ userId: currentUserId }) });
      router.refresh();
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-4">
        <RouteMap
          origin={{ lat: trip.originLat, lng: trip.originLng }}
          destination={{ lat: trip.destinationLat, lng: trip.destinationLng }}
        />

        <Card>
          <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {isHost ? 'You are hosting this trip' : `Host: ${trip.host.fullName}`}
              </h2>
              <p className="text-xs text-gray-500">
                {roleLabel(trip.host.role)} · ★ {trip.host.trustScore.toFixed(1)} Trust Score
              </p>
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>

          <div className="text-sm text-gray-600 space-y-2">
            <p>
              <span className="font-semibold block text-gray-800">Route</span>
              {trip.originAddress} → {trip.destinationAddress}
            </p>
            <p suppressHydrationWarning>
              <span className="font-semibold block text-gray-800">Schedule</span>
              {formatTime(trip.departureTime)} ({formatDate(trip.departureTime)} · {recurrenceLabel(trip.recurrenceType)})
            </p>
            <p>
              <span className="font-semibold block text-gray-800">Vehicle</span>
              {trip.vehicle.make} {trip.vehicle.model} ({trip.vehicle.color})
              {trip.vehicle.plate && <span className="text-gray-500"> · Plate {trip.vehicle.plate}</span>}
            </p>
            <p>
              <span className="font-semibold block text-gray-800">Seats</span>
              {trip.totalSeats - trip.filledSeats} available ({trip.filledSeats}/{trip.totalSeats} filled)
            </p>
            {trip.driverNotes && (
              <p>
                <span className="font-semibold block text-gray-800">Driver Notes</span>
                {trip.driverNotes}
              </p>
            )}
          </div>
        </Card>

        {(trip.fuelShareSuggested != null || myMatch) && (
          <div className="bg-[color:var(--rsu-color-primary)] text-white rounded-2xl p-5 shadow-md">
            <h3 className="text-sm font-bold mb-1">Voluntary Fuel Share</h3>
            <p className="text-xs text-white/80 mb-3">
              Calculated based on distance and current occupancy — not a fare, arranged directly between riders.
            </p>
            <p className="text-2xl font-bold">
              ₱{(myMatch ? myMatch.fuelShareAmount : trip.fuelShareSuggested ?? 0).toFixed(2)}
            </p>
          </div>
        )}

        {!isHost && myMatch && trip.status === 'COMPLETED' && (
          <button
            type="button"
            onClick={() => setRating({ matchId: myMatch.id, rateeId: trip.host.id, rateeName: trip.host.fullName })}
            className="rsu-btn-primary w-full"
          >
            Rate {trip.host.fullName}
          </button>
        )}

        <Card>
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            {isHost ? `Passengers (${trip.matches.length})` : `Co-riders (${trip.matches.length - (myMatch ? 1 : 0)})`}
          </h3>
          {trip.matches.length === 0 && <p className="text-xs text-gray-400">No passengers yet.</p>}
          <ul className="space-y-2">
            {trip.matches
              .filter((m) => isHost || m.passengerId !== currentUserId)
              .map((m) => {
                const mStatus = matchStatusBadge(m.status);
                return (
                  <li key={m.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-[10px] font-bold">
                        {m.passenger.fullName.charAt(0)}
                      </div>
                      <span className="text-xs font-medium text-gray-800">{m.passenger.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={mStatus.tone}>{mStatus.label}</Badge>
                      {isHost && m.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            disabled={busyMatchId === m.id}
                            onClick={() => respond(m.id, 'APPROVED')}
                            className="text-xs font-semibold text-green-700 hover:underline disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyMatchId === m.id}
                            onClick={() => respond(m.id, 'DECLINED')}
                            className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {isHost && trip.status === 'COMPLETED' && m.status === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => setRating({ matchId: m.id, rateeId: m.passengerId, rateeName: m.passenger.fullName })}
                          className="text-xs font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
                        >
                          Rate
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        </Card>

        {isHost && tripIsActive && (
          <button type="button" onClick={markCompleted} disabled={completing} className="rsu-btn-secondary w-full disabled:opacity-60">
            {completing ? 'Marking Completed...' : 'Mark Trip as Completed'}
          </button>
        )}

        {canCancel && (
          <button type="button" onClick={() => setShowCancelModal(true)} className="rsu-btn-danger w-full">
            <FaBan className="w-3.5 h-3.5" />
            {isHost ? 'Cancel Trip' : 'Cancel My Spot'}
          </button>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <h3 className="text-sm font-bold text-gray-900 mb-3">Preferences</h3>
          <dl className="space-y-3 text-xs">
            <div>
              <dt className="text-gray-400">Gender Preference</dt>
              <dd className="text-gray-800 font-medium">{trip.genderPreference === 'ANY' ? 'Any' : 'Same-gender only'}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Departure Flexibility</dt>
              <dd className="text-gray-800 font-medium">
                {trip.flexibleDeparture ? `Flexible (±${trip.flexWindowMinutes} min)` : 'Not flexible'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">Familiar Riders</dt>
              <dd className="text-gray-800 font-medium">{trip.familiarRidersOnly ? 'Familiar riders only' : 'Open to all'}</dd>
            </div>
          </dl>
        </Card>

        <button
          type="button"
          title="Reporting isn't available yet"
          className="flex items-center gap-2 text-xs text-gray-400 cursor-not-allowed"
        >
          <FaFlag className="w-3 h-3" />
          Report Issue
        </button>
      </div>

      {rating && (
        <RatingModal
          matchId={rating.matchId}
          raterId={currentUserId}
          rateeId={rating.rateeId}
          rateeName={rating.rateeName}
          onClose={() => setRating(null)}
          onSubmitted={() => setRating(null)}
        />
      )}

      {showCancelModal && (
        <CancelTripModal
          tripId={trip.id}
          userId={currentUserId}
          role={isHost ? 'host' : 'passenger'}
          onClose={() => setShowCancelModal(false)}
          onCancelled={() => {
            setShowCancelModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

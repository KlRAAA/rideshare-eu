'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaFlag, FaBan, FaPen } from 'react-icons/fa';
import Card from '@/components/Card';
import RouteMap from '@/components/RouteMap';
import RatingModal from '@/components/RatingModal';
import CancelTripModal from '@/components/CancelTripModal';
import DriverIdentityCard from '@/components/DriverIdentityCard';
import TripSummaryCard from '@/components/TripSummaryCard';
import FuelShareCard from '@/components/FuelShareCard';
import CoRidersCard from '@/components/CoRidersCard';
import { apiFetch, ApiError } from '@/lib/api';
import { checkCampusProximity, getCurrentCoords } from '@/lib/geoProximity';
import { LOCATION_POLL_INTERVAL_MS } from '@/lib/constants';

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
  avatarUrl?: string | null;
}

interface MatchInfo {
  id: string;
  passengerId: string;
  status: string;
  message: string | null;
  fuelShareAmount: number | null;
  ratedByMe?: boolean;
  // Recurring trips only: an APPROVED match never becomes COMPLETED (it's a
  // standing rider across every occurrence), so it can't use `ratedByMe` +
  // status to gate the Rate button the way a ONE_TIME match does. This is the
  // occurrence the server actually prompted this viewer to rate and hasn't
  // seen a rating for yet — null when there's nothing currently ratable.
  unratedOccurrenceDate?: string | null;
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
  fuelSharePerSeat: number | null;
  driverNotes: string | null;
  meetingPointAddress: string | null;
  meetingPointLat: number | null;
  meetingPointLng: number | null;
  routeWaypoints: { lat: number; lng: number }[] | null;
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
  // Match id from a "requested to join" notification — scrolled into view and
  // ringed on arrival so the host doesn't hunt through multiple pending rows.
  highlightRequestId?: string | null;
}

export default function TripDetailClient({
  trip,
  currentUserId,
  liveLocationSharing = false,
  highlightRequestId = null,
}: TripDetailClientProps) {
  const router = useRouter();
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [respondError, setRespondError] = useState<{ matchId: string; message: string } | null>(null);
  const [rating, setRating] = useState<{ matchId: string; rateeId: string; rateeName: string; occurrenceDate?: string | null } | null>(
    null
  );
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [completing, setCompleting] = useState(false);

  const isHost = trip.host.id === currentUserId;
  const myMatch = trip.matches.find((m) => m.passengerId === currentUserId);
  const myActiveMatch = myMatch && (myMatch.status === 'PENDING' || myMatch.status === 'APPROVED') ? myMatch : null;
  // The passenger can only rate the host off a match that actually completed —
  // not a declined/cancelled one they also have on this trip (a passenger can
  // re-request after a decline, so `myMatch` alone isn't enough).
  const myCompletedMatch = trip.matches.find((m) => m.passengerId === currentUserId && m.status === 'COMPLETED') ?? null;
  // Recurring counterpart to myCompletedMatch — myMatch stays APPROVED across
  // occurrences, so "ratable" comes from the server-computed occurrence field
  // instead of a status transition.
  const myRatableRecurringMatch =
    !myCompletedMatch && myMatch?.unratedOccurrenceDate ? myMatch : null;
  // Host sees every request; a co-rider sees everyone but themselves.
  const coRiderMatches = trip.matches.filter((m) => isHost || m.passengerId !== currentUserId);

  // Optimistic bridge: a match just rated in this session, before router.refresh()
  // brings back the server's `ratedByMe`. `hasRated` prefers the fresh server flag.
  const [ratedThisSession, setRatedThisSession] = useState<Set<string>>(new Set());
  const hasRated = (matchId: string) =>
    ratedThisSession.has(matchId) || (trip.matches.find((m) => m.id === matchId)?.ratedByMe ?? false);

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

  // Live location sharing — host side: broadcasts the current position every
  // ~30s while sharing is on and the trip is active. Deliberately its own
  // interval, not folded into the proximity-check effect above: that one is
  // correctly one-shot (check once on mount), this one needs to repeat for
  // the trip's whole active lifetime — sharing one loop would mean either
  // the proximity check re-firing repeatedly (changing existing behavior) or
  // this being one-shot (useless for a live pin). Fails soft exactly like
  // the proximity check: getCurrentCoords resolves null on any failure
  // (permission denied, unsupported, timeout) and a tick just no-ops.
  useEffect(() => {
    if (!isHost || !liveLocationSharing || !tripIsActive) return;
    let cancelled = false;
    const broadcast = () => {
      getCurrentCoords().then((coords) => {
        if (cancelled || !coords) return;
        apiFetch(`/api/trips/${trip.id}/location`, {
          method: 'POST',
          body: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
        }).catch(() => {}); // a missed tick just means the next one tries again
      });
    };
    broadcast();
    const intervalId = setInterval(broadcast, LOCATION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, isHost, liveLocationSharing, tripIsActive]);

  // Live location sharing — passenger side: polls the host's last-known
  // position every ~30s while this viewer has a confirmed seat and the trip
  // is active. The server re-checks the host's sharing preference and point
  // staleness on every read (never trusted from anything cached here), so
  // this just renders whatever comes back — no need to know the host's
  // preference on this side at all.
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    const canWatch = !isHost && myActiveMatch?.status === 'APPROVED' && tripIsActive;
    if (!canWatch) {
      setDriverLocation(null);
      return;
    }
    let cancelled = false;
    const poll = () => {
      apiFetch<{ location: { lat: number; lng: number; updatedAt: string } | null }>(`/api/trips/${trip.id}/location`)
        .then((data) => {
          if (cancelled) return;
          setDriverLocation(data.location ? { lat: data.location.lat, lng: data.location.lng } : null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, isHost, myActiveMatch?.status, tripIsActive]);

  // Arriving from a "requested to join" notification: bring that row into view.
  useEffect(() => {
    if (!highlightRequestId) return;
    const el = document.getElementById(`request-${highlightRequestId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightRequestId]);

  async function respond(matchId: string, action: 'APPROVED' | 'DECLINED') {
    setBusyMatchId(matchId);
    setRespondError(null);
    try {
      await apiFetch(`/api/matches/${matchId}`, { method: 'PATCH', body: JSON.stringify({ status: action }) });
      router.refresh();
    } catch (err) {
      // 409 TRIP_FULL (another approval claimed the last seat first) is the
      // expected case here — the server's own message is already
      // host-facing ("This trip is already full."), so just surface it.
      setRespondError({
        matchId,
        message: err instanceof ApiError ? err.message : 'Couldn’t update that request. Try again in a moment.',
      });
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
          meetingPoint={
            trip.meetingPointLat != null && trip.meetingPointLng != null
              ? { lat: trip.meetingPointLat, lng: trip.meetingPointLng }
              : null
          }
          routeWaypoints={trip.routeWaypoints}
          driverLocation={driverLocation}
        />

        <DriverIdentityCard
          name={trip.host.fullName}
          role={trip.host.role}
          trustScore={trip.host.trustScore}
          avatarUrl={trip.host.avatarUrl}
          note={isHost ? "You're hosting this trip" : undefined}
          href={`/auth/users/${trip.host.id}`}
        />

        <TripSummaryCard trip={trip} />

        {(() => {
          const share = myMatch?.fuelShareAmount ?? trip.fuelSharePerSeat;
          return share != null ? <FuelShareCard amount={share} /> : null;
        })()}

        {!isHost && myCompletedMatch && (
          <button
            type="button"
            disabled={hasRated(myCompletedMatch.id)}
            onClick={() => setRating({ matchId: myCompletedMatch.id, rateeId: trip.host.id, rateeName: trip.host.fullName })}
            className="rsu-btn-primary w-full disabled:opacity-50"
          >
            {hasRated(myCompletedMatch.id) ? `You rated ${trip.host.fullName}` : `Rate ${trip.host.fullName}`}
          </button>
        )}

        {!isHost && myRatableRecurringMatch && !ratedThisSession.has(myRatableRecurringMatch.id) && (
          <button
            type="button"
            onClick={() =>
              setRating({
                matchId: myRatableRecurringMatch.id,
                rateeId: trip.host.id,
                rateeName: trip.host.fullName,
                occurrenceDate: myRatableRecurringMatch.unratedOccurrenceDate,
              })
            }
            className="rsu-btn-primary w-full"
          >
            Rate {trip.host.fullName} for this ride
          </button>
        )}

        <CoRidersCard
          matches={coRiderMatches}
          highlightId={highlightRequestId}
          title={
            isHost
              ? `Passengers (${trip.matches.length})`
              : `Co-riders (${trip.matches.length - (myMatch ? 1 : 0)})`
          }
          emptyLabel={isHost ? 'No passengers yet.' : 'No co-riders yet.'}
          renderActions={
            isHost
              ? (m) => {
                  if (m.status === 'PENDING') {
                    // Real buttons with a full-width row to themselves (see
                    // CoRidersCard) rather than small adjacent text links —
                    // Approve/Decline sitting right next to each other at
                    // thumb-sized targets was an easy mis-tap on mobile.
                    return (
                      <>
                        <div className="flex gap-2 w-full">
                          <button
                            type="button"
                            disabled={busyMatchId === m.id}
                            onClick={() => respond(m.id, 'APPROVED')}
                            className="rsu-btn-primary flex-1 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyMatchId === m.id}
                            onClick={() => respond(m.id, 'DECLINED')}
                            className="rsu-btn-danger flex-1 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                        {respondError?.matchId === m.id && (
                          <p className="text-xs text-red-600">{respondError.message}</p>
                        )}
                      </>
                    );
                  }
                  if (m.status === 'COMPLETED') {
                    return (
                      <button
                        type="button"
                        disabled={hasRated(m.id)}
                        onClick={() => setRating({ matchId: m.id, rateeId: m.passengerId, rateeName: m.passenger.fullName })}
                        className="text-xs font-semibold text-[color:var(--rsu-color-primary)] hover:underline disabled:opacity-50 disabled:no-underline"
                      >
                        {hasRated(m.id) ? 'Rated' : 'Rate'}
                      </button>
                    );
                  }
                  if (m.status === 'APPROVED' && m.unratedOccurrenceDate && !ratedThisSession.has(m.id)) {
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          setRating({
                            matchId: m.id,
                            rateeId: m.passengerId,
                            rateeName: m.passenger.fullName,
                            occurrenceDate: m.unratedOccurrenceDate,
                          })
                        }
                        className="text-xs font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
                      >
                        Rate
                      </button>
                    );
                  }
                  return null;
                }
              : undefined
          }
        />

        {isHost && tripIsActive && (
          <Link
            href={`/auth/trips/${trip.id}/edit`}
            className="rsu-btn-secondary w-full flex items-center justify-center gap-2"
          >
            <FaPen className="w-3.5 h-3.5" />
            Edit Trip
          </Link>
        )}

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
          occurrenceDate={rating.occurrenceDate}
          onClose={() => setRating(null)}
          onSubmitted={() => {
            setRatedThisSession((prev) => new Set(prev).add(rating.matchId));
            setRating(null);
            router.refresh(); // pull the updated trust score + ratedByMe / unratedOccurrenceDate flags
          }}
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

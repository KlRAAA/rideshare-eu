'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaFlag, FaBan, FaPen } from 'react-icons/fa';
import Card from '@/components/Card';
import LiveRouteMap from '@/components/LiveRouteMap';
import RatingModal from '@/components/RatingModal';
import CancelTripModal from '@/components/CancelTripModal';
import DriverIdentityCard from '@/components/DriverIdentityCard';
import TripSummaryCard from '@/components/TripSummaryCard';
import FuelShareCard from '@/components/FuelShareCard';
import CoRidersCard from '@/components/CoRidersCard';
import ChatCard from '@/components/ChatCard';
import ReportModal from '@/components/ReportModal';
import { apiFetch, ApiError } from '@/lib/api';
import { getCurrentCoords, isNearCampus } from '@/lib/geoProximity';
import { LOCATION_POLL_INTERVAL_MS } from '@/lib/constants';
import { fetchRoute } from '@/lib/directions';
import TripRunPanel, { type CurrentRun, type NextDeparture } from '@/components/TripRunPanel';
import RuleBadges from '@/components/RuleBadges';
import TripDaysCard from '@/components/TripDaysCard';
import { findAnotherRideHref, riderDayLine, type TripDay } from '@/lib/tripDays';
import { whoCanJoinLabel } from '@/lib/riderRules';

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
  durationSeconds?: number | null;
  host: SafeUser;
  matches: MatchInfo[];
  // Sub-project B: today's run and the next startable departure.
  currentRun: CurrentRun | null;
  nextDeparture: NextDeparture | null;
  // Sub-project D: the next 7 run days and what the driver said about each.
  days: TripDay[];
  cancelReason: string | null;
}

interface TripDetailClientProps {
  trip: TripDetail;
  currentUserId: string;
  // Match id from a "requested to join" notification — scrolled into view and
  // ringed on arrival so the host doesn't hunt through multiple pending rows.
  highlightRequestId?: string | null;
}

export default function TripDetailClient({
  trip,
  currentUserId,
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
  const [reportTarget, setReportTarget] = useState<{ matchId: string; name: string } | null>(null);

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
  // Nobody cancels a trip that's on the road (sub-project B; the server refuses too).
  const canCancel = trip.currentRun?.status !== 'ONGOING' && ((isHost && tripIsActive) || (!isHost && Boolean(myActiveMatch)));
  // Group chat: host + every APPROVED passenger, only while the trip is
  // still active — a hard cutoff, so this simply stops rendering once the
  // trip ends rather than showing a closed/archived state; the server
  // enforces the identical window independently (messageController.js).
  const canUseChat = tripIsActive && (isHost || myActiveMatch?.status === 'APPROVED');

  const runOngoing = trip.currentRun?.status === 'ONGOING';
  const [liveEtaAt, setLiveEtaAt] = useState<string | null>(null);
  // What an approved rider (or one whose driver never came) hears about the next day.
  const [pageOpenedAt] = useState(() => new Date());
  const dayLine =
    !isHost && myMatch && (myActiveMatch?.status === 'APPROVED' || trip.status === 'CANCELLED')
      ? riderDayLine({ ...trip, days: trip.days ?? [], cancelReason: trip.cancelReason ?? null }, pageOpenedAt)
      : null;

  // The driver's phone while a run is ongoing (sub-project B): every ~30 s it
  // sends its position, and every 4th tick (~2 min) the remaining drive time
  // from Mapbox as the live ETA. Arriving near campus ends the run (the server
  // only allows that once started). The screen is kept awake, because a web
  // page can't send location from a locked phone. A failed tick is skipped.
  const arrivedRef = useRef(false);
  useEffect(() => {
    if (!isHost || !runOngoing) return;
    let cancelled = false;
    let tick = 0;
    let wakeLock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((lock) => {
      if (cancelled) lock.release().catch(() => {});
      else wakeLock = lock;
    }).catch(() => {});

    const send = async () => {
      const coords = await getCurrentCoords({ timeout: 10000, maximumAge: 15000 });
      if (cancelled || !coords) return;
      if (isNearCampus(coords) && !arrivedRef.current) {
        arrivedRef.current = true;
        apiFetch(`/api/trips/${trip.id}/arrived`, { method: 'POST', body: JSON.stringify({}) })
          .then(() => router.refresh())
          .catch(() => {});
        return;
      }
      let etaSeconds: number | undefined;
      if (tick++ % 4 === 0) {
        const route = await fetchRoute(coords, { lat: trip.destinationLat, lng: trip.destinationLng });
        if (route) etaSeconds = route.durationSeconds;
      }
      apiFetch(`/api/trips/${trip.id}/location`, {
        method: 'POST',
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng, ...(etaSeconds != null && { etaSeconds }) }),
      }).catch(() => {});
    };
    send();
    const intervalId = setInterval(send, LOCATION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      wakeLock?.release().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, isHost, runOngoing]);

  // Live location sharing — passenger side: whether this viewer may watch the
  // host's live position (confirmed seat, active trip). The actual ~30s poll
  // now lives inside LiveRouteMap, not here — it used to be top-level state in
  // this component, which meant every poll tick re-rendered this entire page
  // (CoRidersCard's renderActions closure, ChatCard, everything) for a value
  // only the map itself reads. The server re-checks the host's sharing
  // preference and point staleness on every read regardless, so this side
  // never needs to know the host's preference, only whether to poll at all.
  const canWatchDriverLocation = !isHost && myActiveMatch?.status === 'APPROVED' && runOngoing;

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
      await apiFetch(`/api/trips/${trip.id}/complete`, { method: 'POST' });
      router.refresh();
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-4">
        <LiveRouteMap
          tripId={trip.id}
          origin={{ lat: trip.originLat, lng: trip.originLng }}
          destination={{ lat: trip.destinationLat, lng: trip.destinationLng }}
          meetingPoint={
            trip.meetingPointLat != null && trip.meetingPointLng != null
              ? { lat: trip.meetingPointLat, lng: trip.meetingPointLng }
              : null
          }
          routeWaypoints={trip.routeWaypoints}
          canWatchDriverLocation={canWatchDriverLocation}
          onEta={setLiveEtaAt}
        />

        {tripIsActive && (isHost || myActiveMatch?.status === 'APPROVED') && (
          <TripRunPanel
            tripId={trip.id}
            isHost={isHost}
            currentRun={trip.currentRun}
            nextDeparture={trip.nextDeparture}
            liveEtaAt={liveEtaAt}
          />
        )}

        {isHost && tripIsActive && !runOngoing && (
          <TripDaysCard tripId={trip.id} recurring={trip.recurrenceType !== 'ONE_TIME'} days={trip.days ?? []} />
        )}

        {dayLine && (
          <div
            role="status"
            className={`rounded-2xl border p-3 text-sm space-y-2 ${
              {
                ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
                neutral: 'border-gray-200 bg-gray-50 text-gray-700',
                warn: 'border-amber-200 bg-amber-50 text-amber-900',
                bad: 'border-red-200 bg-red-50 text-red-900',
              }[dayLine.tone]
            }`}
          >
            <p className="font-semibold">{dayLine.text}</p>
            {dayLine.findAnother && (
              <Link href={findAnotherRideHref(trip, dayLine.departure ?? trip.departureTime)} className="rsu-btn-secondary inline-block px-3 py-1.5 text-xs">
                Find another ride
              </Link>
            )}
          </div>
        )}

        <DriverIdentityCard
          name={trip.host.fullName}
          role={trip.host.role}
          trustScore={trip.host.trustScore}
          avatarUrl={trip.host.avatarUrl}
          note={isHost ? "You're hosting this trip" : undefined}
          href={`/auth/users/${trip.host.id}`}
        />

        <RuleBadges trip={trip} />

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
                  // A report is possible regardless of match status (a PENDING
                  // request's message could itself be the problem) — a matched
                  // relationship already exists the moment the row is a real
                  // Match, so this renders for every status, not just the
                  // ones with a status-specific action below it.
                  const reportLink = (
                    <button
                      type="button"
                      onClick={() => setReportTarget({ matchId: m.id, name: m.passenger.fullName })}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Report
                    </button>
                  );

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
                        {reportLink}
                      </>
                    );
                  }
                  if (m.status === 'COMPLETED') {
                    return (
                      <>
                        <button
                          type="button"
                          disabled={hasRated(m.id)}
                          onClick={() => setRating({ matchId: m.id, rateeId: m.passengerId, rateeName: m.passenger.fullName })}
                          className="text-xs font-semibold text-[color:var(--rsu-color-primary)] hover:underline disabled:opacity-50 disabled:no-underline"
                        >
                          {hasRated(m.id) ? 'Rated' : 'Rate'}
                        </button>
                        {reportLink}
                      </>
                    );
                  }
                  if (m.status === 'APPROVED' && m.unratedOccurrenceDate && !ratedThisSession.has(m.id)) {
                    return (
                      <>
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
                        {reportLink}
                      </>
                    );
                  }
                  return reportLink;
                }
              : undefined
          }
        />

        {canUseChat && <ChatCard tripId={trip.id} currentUserId={currentUserId} />}

        {isHost && tripIsActive && (
          <Link
            href={`/auth/trips/${trip.id}/edit`}
            className="rsu-btn-secondary w-full flex items-center justify-center gap-2"
          >
            <FaPen className="w-3.5 h-3.5" />
            Edit Trip
          </Link>
        )}

        {isHost && tripIsActive && !runOngoing && (
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
              <dt className="text-gray-400">Who Can Join</dt>
              <dd className="text-gray-800 font-medium">{whoCanJoinLabel(trip.genderPreference)}</dd>
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

        {!isHost && myMatch && (
          <button
            type="button"
            onClick={() => setReportTarget({ matchId: myMatch.id, name: trip.host.fullName })}
            className="flex items-center gap-2 text-xs font-semibold text-red-600 hover:underline"
          >
            <FaFlag className="w-3 h-3" />
            Report an issue
          </button>
        )}
      </div>

      {reportTarget && (
        <ReportModal
          reportedUserName={reportTarget.name}
          matchId={reportTarget.matchId}
          onClose={() => setReportTarget(null)}
        />
      )}

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
          activePassengers={trip.matches.filter((m) => m.status === 'APPROVED' || m.status === 'PENDING').length}
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

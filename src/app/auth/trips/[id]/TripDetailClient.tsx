'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaFlag, FaBan, FaPen } from 'react-icons/fa';
import { useAppDialog } from '@/components/AppDialog';
import LiveRouteMap from '@/components/LiveRouteMap';
import RatingModal from '@/components/RatingModal';
import CancelTripModal from '@/components/CancelTripModal';
import DriverIdentityCard from '@/components/DriverIdentityCard';
import TripSummaryCard from '@/components/TripSummaryCard';
import CoRidersCard from '@/components/CoRidersCard';
import ChatCard from '@/components/ChatCard';
import ReportModal from '@/components/ReportModal';
import { apiFetch, ApiError } from '@/lib/api';
import TripRunPanel, { type CurrentRun, type NextDeparture } from '@/components/TripRunPanel';
import RuleBadges from '@/components/RuleBadges';
import TripDaysCard from '@/components/TripDaysCard';
import RiderLocationCard from '@/components/RiderLocationCard';
import RidersNearbyCard from '@/components/RidersNearbyCard';
import type { RiderLocation } from '@/lib/riderLocation';
import { findAnotherRideHref, riderDayLine, type TripDay } from '@/lib/tripDays';
import NavBanner from '@/components/NavBanner';
import NavigateMenu from '@/components/NavigateMenu';
import { useDriverNavigation } from '@/lib/useDriverNavigation';
import { distanceLabel } from '@/lib/navigation';
import { clockLabel } from '@/lib/tripRun';

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
  // Sub-project G: the caller's own sharing switch (approved riders), else null.
  myLocationSharing?: boolean | null;
  myPickedUp?: boolean;
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
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const { confirm, dialog } = useAppDialog();
  const [reportTarget, setReportTarget] = useState<{ matchId: string; name: string } | null>(null);

  const isHost = trip.host.id === currentUserId;
  const myMatch = trip.matches.find((m) => m.passengerId === currentUserId);
  const myActiveMatch = myMatch && (myMatch.status === 'PENDING' || myMatch.status === 'APPROVED') ? myMatch : null;
  // The passenger can only rate the host off a match that actually completed —
  // not a declined/cancelled one they also have on this trip (a passenger can
  // re-request after a decline, so `myMatch` alone isn't enough).
  // One-time trips only: a stopped repeating trip's matches are COMPLETED too,
  // but its days were rated one by one (myRatableRecurringMatch).
  const oneTime = trip.recurrenceType === 'ONE_TIME';
  const myCompletedMatch =
    (oneTime && trip.matches.find((m) => m.passengerId === currentUserId && m.status === 'COMPLETED')) || null;
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

  // A rider who opens a finished ride they haven't rated gets the rating dialog
  // straight away (once per page load; closing it leaves the Rate button).
  const [askedToRate, setAskedToRate] = useState(false);
  useEffect(() => {
    if (askedToRate || isHost) return;
    if (myCompletedMatch && !hasRated(myCompletedMatch.id)) {
      setRating({ matchId: myCompletedMatch.id, rateeId: trip.host.id, rateeName: trip.host.fullName });
    } else if (myRatableRecurringMatch && !ratedThisSession.has(myRatableRecurringMatch.id)) {
      setRating({
        matchId: myRatableRecurringMatch.id,
        rateeId: trip.host.id,
        rateeName: trip.host.fullName,
        occurrenceDate: myRatableRecurringMatch.unratedOccurrenceDate,
      });
    } else {
      return;
    }
    setAskedToRate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when something becomes ratable
  }, [myCompletedMatch?.id, myRatableRecurringMatch?.id, askedToRate, isHost]);

  const tripIsActive = trip.status === 'OPEN' || trip.status === 'FULL';
  // Nobody cancels a trip that's on the road (sub-project B; the server refuses too).
  // Group chat: host + every APPROVED passenger, only while the trip is
  // still active — a hard cutoff, so this simply stops rendering once the
  // trip ends rather than showing a closed/archived state; the server
  // enforces the identical window independently (messageController.js).
  const canUseChat = tripIsActive && (isHost || myActiveMatch?.status === 'APPROVED');

  const runOngoing = trip.currentRun?.status === 'ONGOING';
  const [liveEtaAt, setLiveEtaAt] = useState<string | null>(null);
  // What an approved rider (or one whose driver never came) hears about the next day.
  const [pageOpenedAt] = useState(() => new Date());
  // Sub-project G / live trip map: approved riders for the driver; pins for those not picked up.
  const [riders, setRiders] = useState<RiderLocation[] | null>(null);
  const showRiderPins = useCallback((list: RiderLocation[]) => setRiders(list), []);
  const riderPins = useMemo(
    () => (riders ?? []).flatMap((r) => (r.location && !r.pickedUp ? [{ ...r.location, label: r.fullName }] : [])),
    [riders]
  );
  const [pickedUp, setPickedUp] = useState(false);
  // The driver can't cancel once the trip is moving; a rider can until they're picked up.
  const canCancel = isHost
    ? tripIsActive && trip.currentRun?.status !== 'ONGOING'
    : Boolean(myActiveMatch) && !(trip.currentRun?.status === 'ONGOING' && (trip.myPickedUp || pickedUp));
  // An approved rider's own position while sharing: their map shows the car and themselves.
  const [selfPosition, setSelfPosition] = useState<{ lat: number; lng: number } | null>(null);
  const selfPin = useMemo(() => (selfPosition ? [{ ...selfPosition, label: 'You' }] : undefined), [selfPosition]);
  // Memoised: the GPS hook re-renders this page on every fix, and the map refetches/refits when these change identity.
  const origin = useMemo(() => ({ lat: trip.originLat, lng: trip.originLng }), [trip.originLat, trip.originLng]);
  const destination = useMemo(() => ({ lat: trip.destinationLat, lng: trip.destinationLng }), [trip.destinationLat, trip.destinationLng]);
  const meetingPoint = useMemo(
    () => (trip.meetingPointLat != null && trip.meetingPointLng != null ? { lat: trip.meetingPointLat, lng: trip.meetingPointLng } : null),
    [trip.meetingPointLat, trip.meetingPointLng]
  );
  const pickupPoint = useMemo(() => meetingPoint ?? origin, [meetingPoint, origin]);
  const approvedCount = trip.matches.filter((m) => m.status === 'APPROVED').length;
  const someoneWaiting = riders === null ? approvedCount > 0 : riders.some((r) => !r.pickedUp);
  const departureForSharing = trip.nextDeparture?.departure ?? null;
  const dayLine =
    !isHost && myMatch && (myActiveMatch?.status === 'APPROVED' || trip.status === 'CANCELLED')
      ? riderDayLine({ ...trip, days: trip.days ?? [], cancelReason: trip.cancelReason ?? null }, pageOpenedAt)
      : null;

  // Live trip map: GPS, route, turn guidance and the 10 s position sends.
  const nav = useDriverNavigation({
    tripId: trip.id,
    active: isHost && runOngoing,
    pickup: someoneWaiting ? pickupPoint : null,
    destination,
    onArrived: () => router.refresh(),
  });
  const remainingMeters = nav.route?.distanceMeters ?? null;
  const arriveAt = nav.etaAt ? clockLabel(nav.etaAt) : null;

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

  async function respond(matchId: string, action: 'APPROVED' | 'DECLINED', riderName: string) {
    const seatsAfter = trip.totalSeats - trip.filledSeats - 1;
    const ok = await confirm(
      action === 'APPROVED'
        ? {
            title: `Approve ${riderName}?`,
            message: `${riderName} gets a seat and is told right away. ${seatsAfter <= 0 ? 'That fills your car.' : `${seatsAfter} seat${seatsAfter === 1 ? '' : 's'} left after this.`}`,
            confirmLabel: 'Approve',
          }
        : { title: `Decline ${riderName}?`, message: `${riderName} is told the request was declined.`, confirmLabel: 'Decline', danger: true }
    );
    if (!ok) return;
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
      // The rider took another ride at that time; their request is gone now.
      if (err instanceof ApiError && err.code === 'RIDER_ALREADY_BOOKED') router.refresh();
    } finally {
      setBusyMatchId(null);
    }
  }

  async function stopRepeating() {
    const ok = await confirm({
      title: 'Stop this repeating trip?',
      message: 'It won’t run again. Your riders are told, and open requests are closed.',
      confirmLabel: 'Stop repeating',
      danger: true,
    });
    if (!ok) return;
    setStopping(true);
    setStopError(null);
    try {
      await apiFetch(`/api/trips/${trip.id}/stop-repeating`, { method: 'POST' });
      router.refresh();
    } catch (err) {
      setStopError(
        err instanceof ApiError && err.code === 'TRIP_IN_PROGRESS'
          ? 'End the trip in progress first.'
          : 'Couldn’t stop the trip. Try again in a moment.'
      );
    } finally {
      setStopping(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="space-y-4">
        {isHost && runOngoing && (
          <div className="space-y-2">
            <NavBanner next={nav.next} />
            {nav.blocked && (
              <p role="alert" className="text-sm text-red-600">Allow location for this site so the app can guide you and riders can see you.</p>
            )}
          </div>
        )}

        <LiveRouteMap
          tripId={trip.id}
          origin={origin}
          destination={destination}
          meetingPoint={meetingPoint}
          routeWaypoints={isHost && runOngoing && nav.route ? nav.route.line : trip.routeWaypoints}
          canWatchDriverLocation={canWatchDriverLocation}
          riderLocations={isHost ? riderPins : selfPin}
          ownLocation={isHost && runOngoing ? nav.position : undefined}
          ownHeading={isHost && runOngoing ? nav.heading : null}
          onEta={setLiveEtaAt}
          onPickedUp={setPickedUp}
        />

        {isHost && runOngoing && (
          <div className="rsu-card space-y-3">
            {someoneWaiting ? (
              <div className="text-sm">
                <p className="font-semibold text-gray-900">
                  {`Next: pick up at ${trip.meetingPointAddress ?? 'the start'}${
                    nav.route?.pickupMeters != null ? ` · ${distanceLabel(nav.route.pickupMeters)}` : ''
                  }${nav.route?.pickupSeconds != null ? ` · about ${Math.max(1, Math.round(nav.route.pickupSeconds / 60))} min` : ''}`}
                </p>
                {arriveAt && <p className="text-gray-600">Then campus · arrive about {arriveAt}</p>}
              </div>
            ) : (
              <p className="text-sm font-semibold text-gray-900">
                {`To campus${remainingMeters != null ? ` · ${distanceLabel(remainingMeters)}` : ''}${arriveAt ? ` · arrive about ${arriveAt}` : ''}`}
              </p>
            )}
            <NavigateMenu to={destination} via={someoneWaiting ? pickupPoint : null} />
          </div>
        )}

        {tripIsActive && (isHost || myActiveMatch?.status === 'APPROVED') && (
          <TripRunPanel
            tripId={trip.id}
            isHost={isHost}
            currentRun={trip.currentRun}
            nextDeparture={trip.nextDeparture}
            liveEtaAt={isHost ? nav.etaAt : liveEtaAt}
          />
        )}

        {isHost && tripIsActive && (
          <RidersNearbyCard tripId={trip.id} departure={departureForSharing} runOngoing={runOngoing} onRiders={showRiderPins} />
        )}

        {!isHost && tripIsActive && myActiveMatch?.status === 'APPROVED' && (
          <RiderLocationCard
            tripId={trip.id}
            matchId={myActiveMatch.id}
            initialOn={trip.myLocationSharing === true}
            departure={departureForSharing}
            runOngoing={runOngoing}
            pickedUp={pickedUp && runOngoing}
            onPosition={setSelfPosition}
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

        {!isHost && (
          <DriverIdentityCard
            name={trip.host.fullName}
            role={trip.host.role}
            trustScore={trip.host.trustScore}
            avatarUrl={trip.host.avatarUrl}
            href={`/auth/users/${trip.host.id}`}
          />
        )}

        <RuleBadges trip={trip} />

        <TripSummaryCard trip={trip} fuelShare={myMatch?.fuelShareAmount ?? trip.fuelSharePerSeat} />

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
                            onClick={() => respond(m.id, 'APPROVED', m.passenger.fullName)}
                            className="rsu-btn-primary flex-1 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyMatchId === m.id}
                            onClick={() => respond(m.id, 'DECLINED', m.passenger.fullName)}
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
                  if (m.status === 'COMPLETED' && oneTime) {
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

        {/* The trip's actions, together and quiet: one row, not a stack of full-width buttons. */}
        {((isHost && tripIsActive) || canCancel || (!isHost && myMatch)) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isHost && tripIsActive && (
              <Link href={`/auth/trips/${trip.id}/edit`} className="rsu-btn-secondary flex flex-1 items-center justify-center gap-2">
                <FaPen className="h-3.5 w-3.5" aria-hidden />
                Edit trip
              </Link>
            )}
            {canCancel && (
              <button type="button" onClick={() => setShowCancelModal(true)} className="rsu-btn-danger flex flex-1 items-center justify-center gap-2">
                <FaBan className="h-3.5 w-3.5" aria-hidden />
                {isHost ? 'Cancel trip' : 'Cancel my spot'}
              </button>
            )}
            {isHost && tripIsActive && !runOngoing && !oneTime && (
              <button
                type="button"
                onClick={stopRepeating}
                disabled={stopping}
                className="w-full py-1 text-center text-sm font-semibold text-gray-600 hover:underline disabled:opacity-60"
              >
                {stopping ? 'Stopping…' : 'Stop repeating'}
              </button>
            )}
            {stopError && <p role="alert" className="w-full text-center text-sm text-red-600">{stopError}</p>}
            {!isHost && myMatch && (
              <button
                type="button"
                onClick={() => setReportTarget({ matchId: myMatch.id, name: trip.host.fullName })}
                className="flex w-full items-center justify-center gap-2 py-1 text-sm font-semibold text-red-600 hover:underline"
              >
                <FaFlag className="h-3 w-3" aria-hidden />
                Report an issue
              </button>
            )}
          </div>
        )}
      </div>

      {dialog}
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

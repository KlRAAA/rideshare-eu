'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import RatingModal from '@/components/RatingModal';
import TripRow, { TRIP_LIST } from '@/components/TripRow';
import { formatTime } from '@/lib/format';
import { matchStatusBadge } from '@/lib/statusBadge';
import { seatsLeft, tripRoute, tripWhen } from '@/lib/tripLine';
import { SPANS, newestFirst, withinSpan, type Span } from '@/lib/tripSpans';

interface Vehicle {
  make: string;
  model: string;
  color: string;
}

interface SafeUser {
  id: string;
  fullName: string;
  role: string;
  avatarUrl?: string | null;
}

interface HostedMatch {
  id: string;
  passengerId: string;
  status: string;
  ratedByMe?: boolean;
  // Recurring trips only — see TripDetailClient's MatchInfo for why an
  // APPROVED match needs this instead of status + ratedByMe.
  unratedOccurrenceDate?: string | null;
  passenger: { id: string; fullName: string; avatarUrl?: string | null };
}

export interface HostedTrip {
  id: string;
  originAddress: string;
  destinationAddress: string;
  departureTime: string;
  recurrenceType: string;
  totalSeats: number;
  filledSeats: number;
  vehicle: Vehicle;
  status: string;
  fuelSharePerSeat: number | null;
  matches: HostedMatch[];
  inProgress?: boolean;
  // When it last happened (cancellation, last driven day, or departure).
  // Optional: an API from before this field (mid-deploy) leaves it out.
  lastActiveAt?: string;
}

export interface JoinedTrip extends HostedTrip {
  matchStatus: string;
  matchId: string;
  fuelShareAmount: number | null;
  ratedByMe?: boolean;
  unratedOccurrenceDate?: string | null;
  host: SafeUser;
}

type Tab = 'upcoming' | 'past' | 'cancelled';

function bucketHosted(trip: HostedTrip): Tab {
  if (trip.status === 'CANCELLED') return 'cancelled';
  if (trip.status === 'COMPLETED') return 'past';
  return 'upcoming';
}

function bucketJoined(trip: JoinedTrip): Tab {
  if (trip.matchStatus === 'CANCELLED' || trip.matchStatus === 'DECLINED') return 'cancelled';
  if (trip.matchStatus === 'COMPLETED') return 'past';
  return 'upcoming';
}

interface TripsListClientProps {
  hosted: HostedTrip[];
  joined: JoinedTrip[];
  currentUserId: string;
}

type Rating = { matchId: string; rateeId: string; rateeName: string; occurrenceDate?: string | null };
type RowStatus = React.ComponentProps<typeof TripRow>['status'];

const firstName = (name: string) => name.split(' ')[0];
const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
const byDeparture = <T extends { departureTime: string }>(trips: T[]) =>
  [...trips].sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

// A finished repeating trip says how it repeated and when it last ran.
// Fills a missing lastActiveAt with the departure, so the list still sorts.
function withDate<T extends HostedTrip>(trip: T): T & { lastActiveAt: string } {
  return { ...trip, lastActiveAt: trip.lastActiveAt ?? trip.departureTime };
}

function whenLine(trip: HostedTrip & { lastActiveAt: string }, tab: Tab): string {
  if (tab === 'upcoming' || trip.recurrenceType === 'ONE_TIME') return tripWhen(trip);
  return `${tripWhen(trip)} · last ${shortDay(trip.lastActiveAt)}`;
}

// Only what the tab doesn't already say: in progress, full, waiting, declined.
function hostedStatus(trip: HostedTrip): RowStatus {
  if (trip.inProgress) return { label: 'In progress', tone: 'info' };
  if (trip.status === 'FULL') return { label: 'Full', tone: 'neutral' };
  return null;
}

function joinedStatus(trip: JoinedTrip): RowStatus {
  if (trip.inProgress) return { label: 'In progress', tone: 'info' };
  if (trip.matchStatus === 'PENDING') return { label: 'Waiting for driver', tone: 'warning' };
  if (trip.matchStatus === 'DECLINED') return matchStatusBadge('DECLINED');
  return null;
}

function RateButton({ r, done, onRate }: { r: Rating; done?: boolean; onRate: (r: Rating) => void }) {
  return (
    <button
      type="button"
      disabled={done}
      onClick={() => onRate(r)}
      className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline disabled:font-normal disabled:text-gray-500 disabled:no-underline"
    >
      {done ? `Rated ${firstName(r.rateeName)}` : `Rate ${firstName(r.rateeName)}`}
    </button>
  );
}

// One list per tab, a row per trip. Cancel lives on the trip page (with its
// reason and warnings), not in the list.
export default function TripsListClient({ hosted, joined, currentUserId }: TripsListClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('upcoming');
  // Past and Cancelled reach back 30 days unless the user widens it.
  const [span, setSpan] = useState<Span>('30d');
  const [rating, setRating] = useState<Rating | null>(null);
  // Matches rated in this session, before router.refresh() brings back the
  // server's `ratedByMe`. `hasRated` prefers the server flag when present.
  const [ratedMatchIds, setRatedMatchIds] = useState<Set<string>>(new Set());
  const hasRated = (matchId: string, serverFlag?: boolean) => Boolean(serverFlag) || ratedMatchIds.has(matchId);

  const counts: Record<Tab, number> = { upcoming: 0, past: 0, cancelled: 0 };
  hosted.forEach((t) => counts[bucketHosted(t)]++);
  joined.forEach((t) => counts[bucketJoined(t)]++);

  // Upcoming: soonest first. Past and Cancelled: newest first, within the span.
  const arrange = <T extends HostedTrip & { lastActiveAt: string }>(trips: T[]) =>
    tab === 'upcoming' ? byDeparture(trips) : newestFirst(trips.filter((t) => withinSpan(t.lastActiveAt, span)));
  const visibleHosted = arrange(hosted.filter((t) => bucketHosted(t) === tab).map(withDate));
  const visibleJoined = arrange(joined.filter((t) => bucketJoined(t) === tab).map(withDate));
  const isEmpty = visibleHosted.length === 0 && visibleJoined.length === 0;
  const hiddenBySpan = tab !== 'upcoming' && span !== 'all' && isEmpty && counts[tab] > 0;

  // Who to rate under a trip you drove. A one-time trip rates its COMPLETED
  // riders; a repeating trip rates its last driven day (unratedOccurrenceDate).
  function hostedRatings(trip: HostedTrip) {
    const oneTime = trip.recurrenceType === 'ONE_TIME';
    return trip.matches.flatMap((m) => {
      const r = { matchId: m.id, rateeId: m.passengerId, rateeName: m.passenger.fullName };
      if (oneTime && tab === 'past' && m.status === 'COMPLETED') {
        return [<RateButton key={m.id} r={r} done={hasRated(m.id, m.ratedByMe)} onRate={setRating} />];
      }
      if (!oneTime && m.unratedOccurrenceDate && !ratedMatchIds.has(m.id)) {
        return [<RateButton key={m.id} r={{ ...r, occurrenceDate: m.unratedOccurrenceDate }} onRate={setRating} />];
      }
      return [];
    });
  }

  function joinedRating(trip: JoinedTrip) {
    const r = { matchId: trip.matchId, rateeId: trip.host.id, rateeName: trip.host.fullName };
    if (trip.recurrenceType === 'ONE_TIME' && tab === 'past') {
      return <RateButton r={r} done={hasRated(trip.matchId, trip.ratedByMe)} onRate={setRating} />;
    }
    if (tab === 'upcoming' && trip.unratedOccurrenceDate && !ratedMatchIds.has(trip.matchId)) {
      return <RateButton r={{ ...r, occurrenceDate: trip.unratedOccurrenceDate }} onRate={setRating} />;
    }
    return null;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex max-w-md rounded-xl bg-gray-200/70 p-1">
        {(['upcoming', 'past', 'cancelled'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {t} {counts[t] > 0 && <span className="text-gray-400">{counts[t]}</span>}
          </button>
        ))}
      </div>

      {tab !== 'upcoming' && (
        <div role="group" aria-label="Time span" className="mb-4 flex flex-wrap gap-2">
          {SPANS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSpan(s.value)}
              aria-pressed={span === s.value}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${
                span === s.value ? 'bg-[color:var(--rsu-color-primary)] text-white' : 'border border-gray-200 bg-white text-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {hiddenBySpan ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center">
          <p className="text-sm text-gray-500">Nothing in the {SPANS.find((s) => s.value === span)?.label.toLowerCase()}.</p>
          <button type="button" onClick={() => setSpan('all')} className="text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
            Show all time
          </button>
        </div>
      ) : isEmpty ? (
        <p className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">Nothing here yet.</p>
      ) : (
        <ul className={TRIP_LIST}>
          {visibleHosted.map((trip) => {
            const ratings = hostedRatings(trip);
            return (
              <TripRow
                key={`host-${trip.id}`}
                href={`/auth/trips/${trip.id}`}
                time={formatTime(trip.departureTime)}
                title={tripRoute(trip)}
                detail={tab === 'upcoming' ? `${tripWhen(trip)} · ${seatsLeft(trip)}` : whenLine(trip, tab)}
                status={hostedStatus(trip)}
              >
                {ratings.length > 0 ? ratings : null}
              </TripRow>
            );
          })}
          {visibleJoined.map((trip) => (
            <TripRow
              key={`join-${trip.matchId}`}
              href={`/auth/trips/${trip.id}`}
              time={formatTime(trip.departureTime)}
              title={tripRoute(trip)}
              detail={`${whenLine(trip, tab)} · ${firstName(trip.host.fullName)} drives`}
              status={joinedStatus(trip)}
            >
              {joinedRating(trip)}
            </TripRow>
          ))}
        </ul>
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
            setRatedMatchIds((prev) => new Set(prev).add(rating.matchId));
            setRating(null);
            router.refresh(); // pull the ratee's updated trust score + ratedByMe flags
          }}
        />
      )}
    </div>
  );
}

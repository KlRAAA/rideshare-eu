'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaBan } from 'react-icons/fa';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import RatingModal from '@/components/RatingModal';
import CancelTripModal from '@/components/CancelTripModal';
import { formatDate, formatTime, recurrenceLabel, roleLabel } from '@/lib/format';
import { tripStatusBadge, matchStatusBadge } from '@/lib/statusBadge';

interface Vehicle {
  make: string;
  model: string;
  color: string;
}

interface SafeUser {
  id: string;
  fullName: string;
  role: string;
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
  fuelShareSuggested: number | null;
}

export interface JoinedTrip extends HostedTrip {
  matchStatus: string;
  matchId: string;
  fuelShareAmount: number;
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

function initial(name: string) {
  return name.charAt(0).toUpperCase();
}

interface TripsListClientProps {
  hosted: HostedTrip[];
  joined: JoinedTrip[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
}

export default function TripsListClient({ hosted, joined, currentUserId, currentUserName, currentUserRole }: TripsListClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [rating, setRating] = useState<{ matchId: string; rateeId: string; rateeName: string } | null>(null);
  const [ratedMatchIds, setRatedMatchIds] = useState<Set<string>>(new Set());
  const [cancelTarget, setCancelTarget] = useState<{ tripId: string; role: 'host' | 'passenger' } | null>(null);

  const hostedByTab = { upcoming: 0, past: 0, cancelled: 0 };
  hosted.forEach((t) => hostedByTab[bucketHosted(t)]++);
  const joinedByTab = { upcoming: 0, past: 0, cancelled: 0 };
  joined.forEach((t) => joinedByTab[bucketJoined(t)]++);

  const counts: Record<Tab, number> = {
    upcoming: hostedByTab.upcoming + joinedByTab.upcoming,
    past: hostedByTab.past + joinedByTab.past,
    cancelled: hostedByTab.cancelled + joinedByTab.cancelled,
  };

  const visibleHosted = hosted.filter((t) => bucketHosted(t) === tab);
  const visibleJoined = joined.filter((t) => bucketJoined(t) === tab);
  const isEmpty = visibleHosted.length === 0 && visibleJoined.length === 0;

  return (
    <div>
      <div className="flex bg-gray-200/70 p-1 rounded-xl mb-6 max-w-md">
        {(['upcoming', 'past', 'cancelled'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all capitalize ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {t} {counts[t] > 0 && <span className="text-gray-400">{counts[t]}</span>}
          </button>
        ))}
      </div>

      {isEmpty ? (
        <Card>
          <p className="text-sm text-gray-400 text-center py-8">No trips in this category</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleHosted.map((trip) => {
            const status = tripStatusBadge(trip.status);
            return (
              <Card key={`host-${trip.id}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-bold border border-gray-200">
                      {initial(currentUserName)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{currentUserName}</p>
                      <Badge tone="neutral">{roleLabel(currentUserRole)}</Badge>
                    </div>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>

                <p className="text-sm font-semibold text-gray-900">
                  {trip.originAddress} <span className="text-gray-400 font-normal">to</span> {trip.destinationAddress}
                </p>
                <p className="text-xs text-gray-500 mt-1" suppressHydrationWarning>
                  {formatTime(trip.departureTime)} · {formatDate(trip.departureTime)} · {recurrenceLabel(trip.recurrenceType)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {trip.totalSeats - trip.filledSeats} seats available ({trip.filledSeats}/{trip.totalSeats} filled)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {trip.vehicle.make} {trip.vehicle.model} ({trip.vehicle.color})
                </p>
                {trip.fuelShareSuggested != null && (
                  <p className="text-xs font-semibold text-[color:var(--rsu-color-primary)] mt-1">
                    Fuel share: ₱{trip.fuelShareSuggested.toFixed(0)} per passenger
                  </p>
                )}

                <div className="flex gap-2 mt-4">
                  <Link href={`/auth/trips/${trip.id}`} className="rsu-btn-secondary flex-1">
                    View Details
                  </Link>
                  {tab === 'upcoming' && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget({ tripId: trip.id, role: 'host' })}
                      className="rsu-btn-danger flex-1"
                    >
                      <FaBan className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  )}
                </div>
              </Card>
            );
          })}

          {visibleJoined.map((trip) => {
            const status = matchStatusBadge(trip.matchStatus);
            const alreadyRated = ratedMatchIds.has(trip.matchId);
            return (
              <Card key={`join-${trip.matchId}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-bold border border-gray-200">
                      {initial(trip.host.fullName)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{trip.host.fullName}</p>
                      <Badge tone="neutral">{roleLabel(trip.host.role)}</Badge>
                    </div>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>

                <p className="text-sm font-semibold text-gray-900">
                  {trip.originAddress} <span className="text-gray-400 font-normal">to</span> {trip.destinationAddress}
                </p>
                <p className="text-xs text-gray-500 mt-1" suppressHydrationWarning>
                  {formatTime(trip.departureTime)} · {formatDate(trip.departureTime)} · {recurrenceLabel(trip.recurrenceType)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {trip.vehicle.make} {trip.vehicle.model} ({trip.vehicle.color})
                </p>
                <p className="text-xs font-semibold text-[color:var(--rsu-color-primary)] mt-1">
                  Fuel share: ₱{trip.fuelShareAmount.toFixed(0)} per passenger
                </p>

                <div className="flex gap-2 mt-4">
                  <Link href={`/auth/trips/${trip.id}`} className="rsu-btn-secondary flex-1">
                    View Details
                  </Link>
                  {tab === 'past' && (
                    <button
                      type="button"
                      disabled={alreadyRated}
                      onClick={() => setRating({ matchId: trip.matchId, rateeId: trip.host.id, rateeName: trip.host.fullName })}
                      className="rsu-btn-primary flex-1 disabled:opacity-50"
                    >
                      {alreadyRated ? 'Rated' : 'Rate'}
                    </button>
                  )}
                  {tab === 'upcoming' && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget({ tripId: trip.id, role: 'passenger' })}
                      className="rsu-btn-danger flex-1"
                    >
                      <FaBan className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {rating && (
        <RatingModal
          matchId={rating.matchId}
          raterId={currentUserId}
          rateeId={rating.rateeId}
          rateeName={rating.rateeName}
          onClose={() => setRating(null)}
          onSubmitted={() => {
            setRatedMatchIds((prev) => new Set(prev).add(rating.matchId));
            setRating(null);
          }}
        />
      )}

      {cancelTarget && (
        <CancelTripModal
          tripId={cancelTarget.tripId}
          userId={currentUserId}
          role={cancelTarget.role}
          onClose={() => setCancelTarget(null)}
          onCancelled={() => {
            setCancelTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

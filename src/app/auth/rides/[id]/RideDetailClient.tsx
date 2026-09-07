'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaUserPlus, FaCheckCircle, FaClock } from 'react-icons/fa';
import Card from '@/components/Card';
import RouteMap, { type OverlapData, type LatLng } from '@/components/RouteMap';
import { apiFetch } from '@/lib/api';
import DriverIdentityCard from '@/components/DriverIdentityCard';
import TripSummaryCard from '@/components/TripSummaryCard';
import FuelShareCard from '@/components/FuelShareCard';
import CoRidersCard from '@/components/CoRidersCard';
import RequestToJoinModal from '@/components/RequestToJoinModal';

interface Vehicle {
  make: string;
  model: string;
  color: string;
  plate?: string | null;
}

interface Host {
  id: string;
  fullName: string;
  role: string;
  trustScore: number;
  avatarUrl?: string | null;
}

interface RideMatch {
  id: string;
  passengerId: string;
  status: string;
  message: string | null;
  fuelShareAmount: number | null;
  passenger: { fullName: string; avatarUrl?: string | null };
}

export interface RideDetail {
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
  routeWaypoints: LatLng[] | null;
  genderPreference: string;
  flexibleDeparture: boolean;
  flexWindowMinutes: number;
  familiarRidersOnly: boolean;
  host: Host;
  matches: RideMatch[];
}

export interface MatchParams {
  score: number;
  routeOverlap: number;
  scheduleAlignment: number;
  preferenceMatch: boolean;
}

interface RideDetailClientProps {
  trip: RideDetail;
  currentUserId: string;
  matchParams: MatchParams | null;
  // The searcher's own origin/destination, carried from Find a Ride. Present
  // only when this page was opened from a search — drives the overlap layer.
  passengerOrigin: LatLng | null;
  passengerDestination: LatLng | null;
}

export default function RideDetailClient({
  trip,
  currentUserId,
  matchParams,
  passengerOrigin,
  passengerDestination,
}: RideDetailClientProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [justRequested, setJustRequested] = useState(false);

  // Overlap vs detour split — from the same PSGA function Stage 1 filtering uses
  // (POST /api/matches/route-overlap), never recomputed here.
  const [overlap, setOverlap] = useState<(OverlapData & { hostWaypoints: LatLng[] }) | null>(null);
  useEffect(() => {
    if (!passengerOrigin || !passengerDestination) {
      setOverlap(null);
      return;
    }
    let cancelled = false;
    apiFetch<OverlapData & { hostWaypoints: LatLng[]; corridorMeters: number }>('/api/matches/route-overlap', {
      method: 'POST',
      body: JSON.stringify({ tripId: trip.id, origin: passengerOrigin, destination: passengerDestination }),
    })
      .then((r) => {
        if (!cancelled) setOverlap(r);
      })
      .catch(() => {
        if (!cancelled) setOverlap(null);
      });
    return () => {
      cancelled = true;
    };
  }, [trip.id, passengerOrigin, passengerDestination]);

  const myMatch = trip.matches.find((m) => m.passengerId === currentUserId);
  const approvedRiders = trip.matches.filter((m) => m.status === 'APPROVED');
  const seatsLeft = trip.totalSeats - trip.filledSeats;
  const isFull = trip.status === 'FULL' || seatsLeft <= 0;

  const isPending = justRequested || myMatch?.status === 'PENDING';
  const isApproved = myMatch?.status === 'APPROVED';
  const wasDeclined = myMatch?.status === 'DECLINED' && !justRequested;
  const canRequest = !isPending && !isApproved && !isFull && Boolean(matchParams);

  const fuelShareAmount = myMatch?.fuelShareAmount ?? trip.fuelSharePerSeat ?? null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-4">
        <RouteMap
          origin={overlap ? passengerOrigin : { lat: trip.originLat, lng: trip.originLng }}
          destination={overlap ? passengerDestination : { lat: trip.destinationLat, lng: trip.destinationLng }}
          meetingPoint={
            trip.meetingPointLat != null && trip.meetingPointLng != null
              ? { lat: trip.meetingPointLat, lng: trip.meetingPointLng }
              : null
          }
          routeWaypoints={overlap?.hostWaypoints ?? trip.routeWaypoints}
          overlap={overlap}
        />

        <DriverIdentityCard
          name={trip.host.fullName}
          role={trip.host.role}
          trustScore={trip.host.trustScore}
          avatarUrl={trip.host.avatarUrl}
          matchPercent={matchParams ? matchParams.score * 100 : null}
          href={`/auth/users/${trip.host.id}`}
        />

        <TripSummaryCard trip={trip} />

        {fuelShareAmount != null && <FuelShareCard amount={fuelShareAmount} />}

        <CoRidersCard
          matches={approvedRiders}
          title={`Co-riders (${approvedRiders.length})`}
          emptyLabel="No co-riders yet — you'd be the first."
          showNames={Boolean(myMatch)}
        />

        {/* Request to Join — the page's primary action, matched to the fuel
            share card's weight. */}
        <div>
          {isApproved ? (
            <Link
              href={`/auth/trips/${trip.id}`}
              className="rsu-btn-primary w-full flex items-center justify-center gap-2"
            >
              <FaCheckCircle className="w-4 h-4" />
              You&apos;re confirmed — view in My Trips
            </Link>
          ) : isPending ? (
            <>
              <button type="button" disabled className="rsu-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
                <FaClock className="w-4 h-4" />
                Request Sent — Awaiting Driver Approval
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {trip.host.fullName} has been notified. You&apos;ll get a notification when they respond.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!canRequest}
                onClick={() => setShowModal(true)}
                className="rsu-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <FaUserPlus className="w-4 h-4" />
                {isFull ? 'Ride Full' : 'Request to Join Ride'}
              </button>
              {wasDeclined && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  The driver declined your last request for this ride.
                </p>
              )}
              {!isFull && !matchParams && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Open this ride from a route search to request a spot — that&apos;s how your match and fuel share are worked out.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <h3 className="text-sm font-bold text-gray-900 mb-3">Preferences</h3>
          <dl className="space-y-3 text-xs">
            <div>
              <dt className="text-gray-400">Gender Preference</dt>
              <dd className="text-gray-800 font-medium">
                {trip.genderPreference === 'ANY' ? 'Any' : 'Same-gender only'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">Departure Flexibility</dt>
              <dd className="text-gray-800 font-medium">
                {trip.flexibleDeparture ? `Flexible (±${trip.flexWindowMinutes} min)` : 'Not flexible'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">Familiar Riders</dt>
              <dd className="text-gray-800 font-medium">
                {trip.familiarRidersOnly ? 'Familiar riders only' : 'Open to all'}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {showModal && matchParams && (
        <RequestToJoinModal
          tripId={trip.id}
          passengerId={currentUserId}
          hostName={trip.host.fullName}
          matchPayload={matchParams}
          onClose={() => setShowModal(false)}
          onSubmitted={() => {
            setShowModal(false);
            setJustRequested(true);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

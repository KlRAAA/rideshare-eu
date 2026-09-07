import React from 'react';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BackButton from '@/components/BackButton';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import { ApiError } from '@/lib/api';
import PostTripForm, { type EditableTrip } from '@/app/auth/post/PostTripForm';

interface TripApiShape {
  id: string;
  status: string;
  originAddress: string;
  originLat: number;
  originLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  routeWaypoints: { lat: number; lng: number }[] | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  departureTime: string;
  recurrenceType: EditableTrip['recurrenceType'];
  customDays: number[];
  totalSeats: number;
  filledSeats: number;
  fuelSharePerSeat: number | null;
  driverNotes: string | null;
  genderPreference: 'ANY' | 'SAME_GENDER';
  flexibleDeparture: boolean;
  flexWindowMinutes: number;
  familiarRidersOnly: boolean;
  meetingPointAddress: string | null;
  meetingPointLat: number | null;
  meetingPointLng: number | null;
  host: { id: string };
  vehicle: { make: string; model: string; color: string; plate: string | null; fuelEfficiencyKmL: number };
  matches: { status: string }[];
}

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  let trip: TripApiShape;
  try {
    const data = await apiFetch<{ trip: TripApiShape }>(`/api/trips/${id}?userId=${user.id}`);
    trip = data.trip;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  // Host-only, active-trip-only. Anyone else (or a closed trip) gets a 404.
  if (trip.host.id !== user.id) notFound();
  if (trip.status !== 'OPEN' && trip.status !== 'FULL') notFound();

  const editTrip: EditableTrip = {
    id: trip.id,
    originAddress: trip.originAddress,
    originLat: trip.originLat,
    originLng: trip.originLng,
    destinationAddress: trip.destinationAddress,
    destinationLat: trip.destinationLat,
    destinationLng: trip.destinationLng,
    routeWaypoints: trip.routeWaypoints,
    distanceMeters: trip.distanceMeters,
    durationSeconds: trip.durationSeconds,
    departureTime: trip.departureTime,
    recurrenceType: trip.recurrenceType,
    customDays: trip.customDays ?? [],
    totalSeats: trip.totalSeats,
    filledSeats: trip.filledSeats,
    approvedCount: trip.matches.filter((m) => m.status === 'APPROVED').length,
    fuelSharePerSeat: trip.fuelSharePerSeat,
    driverNotes: trip.driverNotes,
    genderPreference: trip.genderPreference,
    flexibleDeparture: trip.flexibleDeparture,
    flexWindowMinutes: trip.flexWindowMinutes,
    familiarRidersOnly: trip.familiarRidersOnly,
    meetingPointAddress: trip.meetingPointAddress,
    meetingPointLat: trip.meetingPointLat,
    meetingPointLng: trip.meetingPointLng,
    vehicle: trip.vehicle,
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="trips" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <BackButton fallback={`/auth/trips/${id}`} className="mb-3" />
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Edit Trip</h1>
          <p className="text-sm text-gray-500 mt-0.5">Update your posted trip</p>
        </div>
        <PostTripForm hostId={user.id} editTrip={editTrip} />
      </main>
      <BottomNav active="trips" />
    </div>
  );
}

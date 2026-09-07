import React from 'react';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BackButton from '@/components/BackButton';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import { ApiError } from '@/lib/api';
import RideDetailClient, { type RideDetail, type MatchParams } from './RideDetailClient';

// The PSGA scores are computed per passenger at search time and not persisted,
// so Find a Ride passes them through the "View Details" link. Opened without
// them (a bookmark, a shared URL), the page still shows the ride but can't start
// a request — there's no match data to attach. The fuel share is NOT here — it's
// the trip's persisted per-seat value.
function parseMatchParams(sp: Record<string, string | string[] | undefined>): MatchParams | null {
  const num = (v: string | string[] | undefined) => (typeof v === 'string' && v !== '' ? Number(v) : NaN);
  const score = num(sp.score);
  const routeOverlap = num(sp.overlap);
  const scheduleAlignment = num(sp.sched);
  if ([score, routeOverlap, scheduleAlignment].some(Number.isNaN)) return null;
  return {
    score,
    routeOverlap,
    scheduleAlignment,
    preferenceMatch: sp.pref === '1',
  };
}

// The searcher's own geocoded origin/destination, carried from Find a Ride so
// the map can draw the overlap layer. Absent on a cold visit.
function parsePassengerPoint(
  latRaw: string | string[] | undefined,
  lngRaw: string | string[] | undefined
): { lat: number; lng: number } | null {
  const lat = typeof latRaw === 'string' ? Number(latRaw) : NaN;
  const lng = typeof lngRaw === 'string' ? Number(lngRaw) : NaN;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export default async function RideDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  let trip: RideDetail;
  try {
    const data = await apiFetch<{ trip: RideDetail }>(`/api/trips/${id}?userId=${user.id}`);
    trip = data.trip;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="search" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <BackButton fallback="/auth/search" className="mb-3" />
        <RideDetailClient
          trip={trip}
          currentUserId={user.id}
          matchParams={parseMatchParams(sp)}
          passengerOrigin={parsePassengerPoint(sp.plat, sp.plng)}
          passengerDestination={parsePassengerPoint(sp.dlat, sp.dlng)}
        />
      </main>
      <BottomNav active="search" />
    </div>
  );
}

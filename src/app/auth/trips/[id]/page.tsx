import React from 'react';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BackButton from '@/components/BackButton';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import { ApiError } from '@/lib/api';
import TripDetailClient, { type TripDetail } from './TripDetailClient';

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ requestId?: string }>;
}) {
  const { id } = await params;
  const { requestId } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  let trip: TripDetail;
  try {
    const data = await apiFetch<{ trip: TripDetail }>(`/api/trips/${id}?userId=${user.id}`);
    trip = data.trip;
  } catch (err) {
    // Only a genuine 404 means "no such trip". A 500 / transient DB error must
    // not render the not-found page — that tells the host their trip vanished.
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { preference } = await apiFetch<{ preference: { liveLocationSharing: boolean } }>(`/api/preferences/${user.id}`);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="trips" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <BackButton fallback="/auth/trips" className="mb-3" />
        <TripDetailClient
          trip={trip}
          currentUserId={user.id}
          liveLocationSharing={preference.liveLocationSharing}
          highlightRequestId={requestId ?? null}
        />
      </main>
      <BottomNav active="trips" />
    </div>
  );
}

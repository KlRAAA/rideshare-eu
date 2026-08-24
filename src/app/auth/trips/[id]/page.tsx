import React from 'react';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api';
import TripDetailClient, { type TripDetail } from './TripDetailClient';

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  let trip: TripDetail;
  try {
    const data = await apiFetch<{ trip: TripDetail }>(`/api/trips/${id}?userId=${user.id}`);
    trip = data.trip;
  } catch {
    notFound();
  }

  const { preference } = await apiFetch<{ preference: { liveLocationSharing: boolean } }>(`/api/preferences/${user.id}`);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="trips" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <TripDetailClient trip={trip} currentUserId={user.id} liveLocationSharing={preference.liveLocationSharing} />
      </main>
      <BottomNav active="trips" />
    </div>
  );
}

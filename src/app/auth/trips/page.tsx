import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import TripsListClient, { type HostedTrip, type JoinedTrip } from './TripsListClient';

export default async function MyTripsPage() {
  const user = await getCurrentUser();

  let hosted: HostedTrip[] = [];
  let joined: JoinedTrip[] = [];
  // Driver mode lists the trips you drive, Passenger mode the rides you joined (sub-project C).
  const isDriver = user?.activeMode === 'DRIVER';

  if (user) {
    const data = await apiFetch<{ hosted: HostedTrip[]; joined: JoinedTrip[] }>(`/api/trips/mine?userId=${user.id}`);
    if (isDriver) hosted = data.hosted;
    else joined = data.joined;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="trips" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{isDriver ? 'My Trips' : 'My Rides'}</h1>
        </div>

        {user ? (
          <TripsListClient hosted={hosted} joined={joined} currentUserId={user.id} />
        ) : (
          <p className="text-sm text-gray-500">Sign in to view your trips.</p>
        )}
      </main>
      <BottomNav active="trips" />
    </div>
  );
}

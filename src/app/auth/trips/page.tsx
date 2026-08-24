import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api';
import TripsListClient, { type HostedTrip, type JoinedTrip } from './TripsListClient';

export default async function MyTripsPage() {
  const user = await getCurrentUser();

  let hosted: HostedTrip[] = [];
  let joined: JoinedTrip[] = [];

  if (user) {
    const data = await apiFetch<{ hosted: HostedTrip[]; joined: JoinedTrip[] }>(`/api/trips/mine?userId=${user.id}`);
    hosted = data.hosted;
    joined = data.joined;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="trips" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
          <p className="text-sm text-gray-500 mt-0.5">View and manage your hosted rides and joined trips</p>
        </div>

        {user ? (
          <TripsListClient
            hosted={hosted}
            joined={joined}
            currentUserId={user.id}
            currentUserName={user.fullName}
            currentUserRole={user.role}
          />
        ) : (
          <p className="text-sm text-gray-500">Sign in to view your trips.</p>
        )}
      </main>
      <BottomNav active="trips" />
    </div>
  );
}

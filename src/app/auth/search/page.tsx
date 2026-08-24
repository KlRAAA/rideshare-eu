import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getCurrentUser } from '@/lib/session';
import SearchClient from './SearchClient';

export default async function SearchRidesPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="search" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Find a Ride</h1>
          <p className="text-sm text-gray-500 mt-0.5">Search for available carpools that match your route</p>
        </div>
        {user ? <SearchClient passengerId={user.id} /> : <p className="text-sm text-gray-500">Sign in to search for rides.</p>}
      </main>
      <BottomNav active="search" />
    </div>
  );
}

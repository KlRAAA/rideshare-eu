import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BackButton from '@/components/BackButton';
import { getCurrentUser } from '@/lib/session';
import SearchClient, { type SearchInitialState } from './SearchClient';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

// The form reflects itself into the query string as the user searches, so
// router.back() from a result page returns here with the same params and the
// form (and results) rebuild from them.
function parseInitial(sp: Record<string, string | string[] | undefined>): SearchInitialState {
  return {
    origin: one(sp.origin),
    destination: one(sp.destination),
    date: one(sp.date),
    time: one(sp.time),
    genderPreference: one(sp.gender) === 'SAME_GENDER' ? 'SAME_GENDER' : 'ANY',
    flexibleTime: one(sp.flex) === '1',
    sortBy: one(sp.sort) === 'earliest' ? 'earliest' : 'best',
  };
}

export default async function SearchRidesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="search" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <BackButton fallback="/auth/dashboard" className="mb-3" />
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Find a Ride</h1>
          <p className="text-sm text-gray-500 mt-0.5">Search for available carpools that match your route</p>
        </div>
        {user ? (
          <SearchClient passengerId={user.id} initial={parseInitial(sp)} />
        ) : (
          <p className="text-sm text-gray-500">Sign in to search for rides.</p>
        )}
      </main>
      <BottomNav active="search" />
    </div>
  );
}

import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Skeleton from '@/components/Skeleton';
import { TRIP_LIST } from '@/components/TripRow';

const TABS = ['upcoming', 'past', 'cancelled'] as const;

// Mirrors TripsListClient: the heading (My Trips or My Rides depends on the
// mode, so it's a placeholder), the tab strip, and the divided trip list.
export default function TripsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="trips" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-4">
          <Skeleton shape="text" width={130} height={28} />
        </div>

        <div className="max-w-2xl">
          <div className="mb-4 flex max-w-md rounded-xl bg-gray-200/70 p-1">
            {TABS.map((t) => (
              <div
                key={t}
                className={`flex-1 rounded-lg py-2 text-center text-xs font-semibold capitalize ${
                  t === 'upcoming' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {t}
              </div>
            ))}
          </div>

          <ul className={TRIP_LIST}>
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton shape="text" width={60} height={14} />
                <div className="flex-1 space-y-1.5">
                  <Skeleton shape="text" width="70%" height={12} />
                  <Skeleton shape="text" width="45%" height={10} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <BottomNav active="trips" />
    </div>
  );
}

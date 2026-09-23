import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Card from '@/components/Card';
import Skeleton from '@/components/Skeleton';

const TABS = ['upcoming', 'past', 'cancelled'] as const;

// MyTripsPage is one async Server Component, so the "My Trips" heading and
// its subtitle -- both static copy, never derived from data -- would
// otherwise disappear during the fetch too. Reproduced here as real text.
// The tab strip's labels are likewise static (only the per-tab counts are
// data-dependent, so those are left off rather than shown as "0" or
// skeletoned individually) -- matching TripsListClient's actual
// bg-gray-200/70 pill-tab styling, "upcoming" pre-selected the same way the
// real component defaults to it. The card grid below mirrors a real hosted-
// trip card: avatar+name+role row, status badge, three detail lines, and a
// two-button row.
export default function TripsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="trips" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
          <p className="text-sm text-gray-500 mt-0.5">View and manage your hosted rides and joined trips</p>
        </div>

        <div className="flex bg-gray-200/70 p-1 rounded-xl mb-6 max-w-md">
          {TABS.map((t) => (
            <div
              key={t}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg text-center capitalize ${
                t === 'upcoming' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {t}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Skeleton shape="circle" width={32} height={32} />
                  <div className="space-y-1.5">
                    <Skeleton shape="text" width={100} height={12} />
                    <Skeleton shape="rect" width={56} height={16} radius="9999px" />
                  </div>
                </div>
                <Skeleton shape="rect" width={54} height={18} radius="9999px" />
              </div>

              <Skeleton shape="text" width="80%" height={13} className="mb-2" />
              <Skeleton shape="text" width="60%" height={11} className="mb-1.5" />
              <Skeleton shape="text" width="45%" height={11} className="mb-3" />

              <div className="flex gap-2">
                <Skeleton shape="rect" height={38} radius="var(--rsu-btn-radius)" className="flex-1" />
                <Skeleton shape="rect" height={38} radius="var(--rsu-btn-radius)" className="flex-1" />
              </div>
            </Card>
          ))}
        </div>
      </main>
      <BottomNav active="trips" />
    </div>
  );
}

import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Skeleton from '@/components/Skeleton';

const ROWS = 'divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white';

// Mirrors ProfileClient: the identity header, then sections of divided rows.
export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="profile" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        </div>

        <div className="flex max-w-2xl flex-col gap-6">
          <div className="flex items-center gap-4">
            <Skeleton shape="circle" width={64} height={64} />
            <div className="flex-1 space-y-2">
              <Skeleton shape="text" width="55%" height={18} />
              <Skeleton shape="text" width="35%" height={12} />
              <Skeleton shape="text" width="60%" height={10} />
            </div>
          </div>

          {[3, 3].map((rows, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton shape="text" width={140} height={15} />
              <div className={ROWS}>
                {Array.from({ length: rows }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between px-4 py-3">
                    <Skeleton shape="text" width="40%" height={12} />
                    <Skeleton shape="rect" width={90} height={30} radius="0.75rem" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav active="profile" />
    </div>
  );
}

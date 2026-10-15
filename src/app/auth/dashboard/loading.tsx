import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Skeleton from '@/components/Skeleton';

// The dashboard's shape while its data loads: greeting, mode switch, the next
// ride, and the alerts list (see page.tsx).
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between pb-24">
      <Header active="dashboard" />

      <main className="app-desktop w-full p-0 pt-2 md:pt-4 space-y-6 flex-grow">
        <section className="space-y-4">
          <Skeleton shape="text" width={160} height={30} />
          <Skeleton shape="rect" width="100%" height={52} radius="9999px" className="max-w-sm" />
        </section>

        <section className="dashboard-main-grid">
          <div className="space-y-3">
            <Skeleton shape="text" width={120} height={18} />
            <div className="rsu-card space-y-2">
              <Skeleton shape="text" width={110} height={30} />
              <Skeleton shape="text" width={150} height={14} />
              <Skeleton shape="text" width="80%" height={16} className="mt-3" />
              <Skeleton shape="text" width="55%" height={14} />
            </div>
          </div>
          <aside className="space-y-3">
            <Skeleton shape="text" width={70} height={18} />
            <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5 px-4 py-3">
                  <Skeleton shape="text" width="90%" height={14} />
                  <Skeleton shape="text" width={70} height={12} />
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>

      <BottomNav active="dashboard" />
    </div>
  );
}

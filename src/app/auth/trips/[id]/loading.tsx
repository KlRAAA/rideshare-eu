import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BackButton from '@/components/BackButton';
import Card from '@/components/Card';
import Skeleton from '@/components/Skeleton';

// Mirrors TripDetailClient's real structure (see that file) rather than a
// generic placeholder: Header/BackButton/BottomNav are real, static
// components with no data dependency, so they're reused as-is here -- the
// page's actual chrome never has to pop in once the real content loads,
// only the middle column does. The grid, map height (h-56/rounded-2xl),
// avatar size (w-12 h-12, matching DriverIdentityCard), and card counts
// below are taken directly from the real component, not guessed.
export default function TripDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="trips" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <BackButton fallback="/auth/trips" className="mb-3" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            {/* RouteMap's real container: h-56, rounded-2xl */}
            <Skeleton shape="rect" height={224} radius="1rem" />

            {/* DriverIdentityCard */}
            <Card>
              <div className="flex items-center gap-3">
                <Skeleton shape="circle" width={48} height={48} />
                <div className="flex-1 space-y-2">
                  <Skeleton shape="text" width="45%" height={14} />
                  <Skeleton shape="text" width="65%" height={11} />
                </div>
              </div>
            </Card>

            {/* TripSummaryCard: header row (title + status badge) + 4 label/value pairs */}
            <Card>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-3">
                <Skeleton shape="text" width={90} height={13} />
                <Skeleton shape="rect" width={56} height={20} radius="9999px" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton shape="text" width={70} height={10} />
                    <Skeleton shape="text" width="80%" height={12} />
                  </div>
                ))}
              </div>
            </Card>

            {/* FuelShareCard slot */}
            <Skeleton shape="rect" height={90} radius="1rem" />

            {/* CoRidersCard: title + 2 rows, each a small avatar + name + status pill */}
            <Card>
              <Skeleton shape="text" width={120} height={13} className="mb-3" />
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="p-2 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Skeleton shape="circle" width={24} height={24} />
                      <Skeleton shape="text" width={90} height={11} />
                    </div>
                    <Skeleton shape="rect" width={60} height={18} radius="9999px" />
                  </div>
                ))}
              </div>
            </Card>

            {/* ChatCard: title + two message-bubble placeholders + input row */}
            <Card>
              <Skeleton shape="text" width={80} height={13} className="mb-3" />
              <div className="space-y-2 mb-3">
                <Skeleton shape="rect" width="55%" height={28} radius="10px" />
                <Skeleton shape="rect" width="70%" height={28} radius="10px" className="ml-auto" />
              </div>
              <div className="flex gap-2">
                <Skeleton shape="rect" height={36} radius="8px" className="flex-1" />
                <Skeleton shape="rect" width={64} height={36} radius="8px" />
              </div>
            </Card>

            {/* Bottom action buttons — a host on an active trip sees all three
                (Edit Trip / Mark Trip as Completed / Cancel Trip) */}
            <Skeleton shape="rect" height={44} radius="var(--rsu-btn-radius)" />
            <Skeleton shape="rect" height={44} radius="var(--rsu-btn-radius)" />
            <Skeleton shape="rect" height={44} radius="var(--rsu-btn-radius)" />
          </div>

          <div className="space-y-4">
            {/* Preferences card: title + 3 label/value pairs */}
            <Card>
              <Skeleton shape="text" width={90} height={13} className="mb-3" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton shape="text" width={110} height={10} />
                    <Skeleton shape="text" width={70} height={12} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>
      <BottomNav active="trips" />
    </div>
  );
}

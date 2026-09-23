import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Card from '@/components/Card';
import Skeleton from '@/components/Skeleton';

// ProfilePage is one async Server Component, so even its static heading text
// would vanish during the fetch without reproducing it here. Mirrors
// ProfileClient's real two-card left column (avatar w-16 h-16, name, role
// badge, email, trust score, photo button) and the right column's
// Matching Preferences card (title + three label/field pairs) -- read from
// the real component, not estimated.
export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="profile" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Profile &amp; Preferences</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your account and ride preferences</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Card className="text-center">
              <Skeleton shape="circle" width={64} height={64} className="mx-auto mb-3" />
              <Skeleton shape="text" width={140} height={16} className="mx-auto mb-2" />
              <Skeleton shape="rect" width={64} height={18} radius="9999px" className="mx-auto mb-3" />
              <Skeleton shape="text" width={170} height={11} className="mx-auto mb-2" />
              <Skeleton shape="text" width={90} height={13} className="mx-auto mb-4" />
              <Skeleton shape="rect" height={40} radius="var(--rsu-btn-radius)" />
            </Card>

            <Card>
              <Skeleton shape="text" width={110} height={13} className="mb-3" />
              <div className="flex justify-between mb-2">
                <Skeleton shape="text" width={80} height={12} />
                <Skeleton shape="text" width={24} height={12} />
              </div>
              <div className="flex justify-between">
                <Skeleton shape="text" width={80} height={12} />
                <Skeleton shape="text" width={24} height={12} />
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            {/* Matching Preferences: title + two select-shaped fields + two toggle rows */}
            <Card>
              <Skeleton shape="text" width={140} height={13} className="mb-1" />
              <Skeleton shape="text" width={200} height={11} className="mb-4" />
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton shape="text" width={150} height={10} className="mb-1.5" />
                    <Skeleton shape="rect" height={40} radius="0.75rem" />
                  </div>
                ))}
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton shape="text" width={130} height={12} />
                    <Skeleton shape="rect" width={36} height={20} radius="9999px" />
                  </div>
                ))}
              </div>
            </Card>

            {/* Account Settings: title + two read-only-input-shaped fields + a text link */}
            <Card>
              <Skeleton shape="text" width={130} height={13} className="mb-1" />
              <Skeleton shape="text" width={190} height={11} className="mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton shape="text" width={90} height={10} className="mb-1.5" />
                    <Skeleton shape="rect" height={40} radius="0.75rem" />
                  </div>
                ))}
                <Skeleton shape="text" width={130} height={12} />
              </div>
            </Card>

            {/* Privacy & Safety: title + a text link */}
            <Card>
              <Skeleton shape="text" width={110} height={13} className="mb-2" />
              <Skeleton shape="text" width={150} height={12} />
            </Card>

            {/* Log Out button */}
            <Skeleton shape="rect" height={44} radius="0.75rem" />
          </div>
        </div>
      </main>
      <BottomNav active="profile" />
    </div>
  );
}

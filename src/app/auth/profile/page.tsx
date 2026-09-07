import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import ProfileClient, { type Preference } from './ProfileClient';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { preference } = await apiFetch<{ preference: Preference }>(`/api/preferences/${user.id}`);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="profile" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Profile &amp; Preferences</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your account and ride preferences</p>
        </div>
        <ProfileClient user={user} initialPreference={preference} />
      </main>
      <BottomNav active="profile" />
    </div>
  );
}

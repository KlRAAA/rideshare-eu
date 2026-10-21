import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import ProfileClient, { type Preference } from './ProfileClient';
import LogoutButton from './LogoutButton';
import LicenseStatusCard from '@/components/LicenseStatusCard';
import PushCard from '@/components/PushCard';
import type { MyLicense } from '@/lib/license';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [{ preference }, license] = await Promise.all([
    apiFetch<{ preference: Preference }>(`/api/preferences/${user.id}`),
    apiFetch<MyLicense>('/api/users/me/license'),
  ]);
  const licenseLabel = license.verified
    ? 'Manage your license'
    : license.license?.status === 'PENDING'
      ? 'View your license'
      : 'Upload your license';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="profile" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-4 flex max-w-2xl items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <LogoutButton />
        </div>
        {/* Remounts after a gender change, which can reset the Women+ preference. */}
        <ProfileClient
          key={user.gender}
          user={user}
          initialPreference={preference}
          license={<LicenseStatusCard my={license} linkLabel={licenseLabel} />}
          notifications={<PushCard placement="profile" />}
        />
      </main>
      <BottomNav active="profile" />
    </div>
  );
}

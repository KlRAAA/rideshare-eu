import Link from 'next/link';
import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import ProfileClient, { type Preference } from './ProfileClient';
import LicenseStatusCard from '@/components/LicenseStatusCard';
import type { MyLicense } from '@/lib/license';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [{ preference }, license] = await Promise.all([
    apiFetch<{ preference: Preference }>(`/api/preferences/${user.id}`),
    apiFetch<MyLicense>('/api/users/me/license'),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="profile" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Profile &amp; Preferences</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your account and ride preferences</p>
        </div>
        {/* Remounts after a gender change, which can reset the Women+ preference. */}
        <ProfileClient key={user.gender} user={user} initialPreference={preference} />
        <div className="mt-4">
          <LicenseStatusCard my={license} linkLabel={license.verified ? 'Manage your license' : license.license?.status === 'PENDING' ? 'View your license' : 'Upload your license'} />
        </div>
        <p className="text-xs text-center text-gray-500 mt-6">
          <Link href="/privacy" className="font-semibold text-gray-500 hover:underline">
            Privacy Policy
          </Link>
          {' · '}
          <Link href="/terms" className="font-semibold text-gray-500 hover:underline">
            Terms of Use
          </Link>
        </p>
      </main>
      <BottomNav active="profile" />
    </div>
  );
}

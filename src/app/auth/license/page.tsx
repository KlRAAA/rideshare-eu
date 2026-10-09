import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BackButton from '@/components/BackButton';
import LicenseStatusCard from '@/components/LicenseStatusCard';
import { apiFetch } from '@/lib/api-server';
import type { MyLicense } from '@/lib/license';
import LicenseForm from './LicenseForm';

// The driver's license: status, and the upload form unless one is under review (sub-project E).
export default async function LicensePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const my = await apiFetch<MyLicense>('/api/users/me/license');
  const welcome = (await searchParams).welcome === '1';
  const pending = my.license?.status === 'PENDING';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="profile" />
      <main className="app-desktop w-full pt-2 md:pt-4 space-y-4">
        <BackButton fallback="/auth/profile" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Driver’s license</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {welcome ? 'Your account is ready. Add your license now so you can post trips once it’s checked.' : 'Needed to post trips as a driver'}
          </p>
        </div>
        <LicenseStatusCard my={my} />
        {!pending && <LicenseForm renewal={my.verified} />}
      </main>
      <BottomNav active="profile" />
    </div>
  );
}

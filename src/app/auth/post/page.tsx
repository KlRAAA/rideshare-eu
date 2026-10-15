import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BackButton from '@/components/BackButton';
import { getCurrentUser } from '@/lib/session';
import PostTripForm from './PostTripForm';
import { isWomenPlusEligible } from '@/lib/riderRules';
import WrongModeNotice from '@/components/WrongModeNotice';
import LicenseStatusCard from '@/components/LicenseStatusCard';
import { apiFetch } from '@/lib/api-server';
import type { MyLicense } from '@/lib/license';
import Link from 'next/link';
import { FaRoute } from 'react-icons/fa';

// One trip at a time: while a trip is in progress, the form waits (demo feedback).
function DrivingNowNotice({ tripId }: { tripId: string }) {
  return (
    <div className="rsu-card flex flex-col items-center text-center gap-3 py-8">
      <FaRoute className="w-6 h-6 text-gray-400" aria-hidden />
      <p className="text-sm font-medium text-gray-800">You’re driving a trip right now.</p>
      <p className="text-sm text-gray-500">End it before you post your next trip.</p>
      <Link href={`/auth/trips/${tripId}`} className="rsu-btn-primary">
        Go to your trip
      </Link>
    </div>
  );
}

export default async function PostTripPage() {
  const user = await getCurrentUser();
  // Only drivers with an approved license post trips (sub-project E).
  const license = user?.activeMode === 'DRIVER' ? await apiFetch<MyLicense>('/api/users/me/license') : null;
  const driving = user && license?.canPost
    ? (await apiFetch<{ hosted: { id: string; inProgress?: boolean }[] }>(`/api/trips/mine?userId=${user.id}`)).hosted.find((t) => t.inProgress)
    : undefined;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="post" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <BackButton fallback="/auth/dashboard" className="mb-3" />
        <div className="mx-auto mb-4 max-w-2xl">
          <h1 className="text-2xl font-bold text-gray-900">Post a Trip</h1>
        </div>
        {user?.activeMode !== 'DRIVER' ? (
          <WrongModeNotice need="DRIVER" />
        ) : license && !license.canPost ? (
          <LicenseStatusCard my={license} linkLabel={license.license?.status === 'PENDING' ? 'View your license' : 'Upload your license'} />
        ) : driving ? (
          <DrivingNowNotice tripId={driving.id} />
        ) : user ? <PostTripForm hostId={user.id} canHostWomenPlus={isWomenPlusEligible(user.gender)} /> : <p className="text-sm text-gray-500">Sign in to post a trip.</p>}
      </main>
      <BottomNav active="post" />
    </div>
  );
}

import React from 'react';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getCurrentUser } from '@/lib/session';
import { adminFetch } from './adminFetch';
import AdminNav, { type AdminNavCounts } from './AdminNav';

// Hides the admin area from everyone else. The API's requireAdmin is the real guard.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();
  const counts = await adminFetch<AdminNavCounts>('/api/admin/nav-counts');

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="profile" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Admin console</h1>
          <p className="text-sm text-gray-500 mt-0.5">Safety, moderation and system settings</p>
        </div>
        <div className="md:grid md:grid-cols-[190px_minmax(0,1fr)] md:gap-6">
          <AdminNav isSuperAdmin={user.isSuperAdmin === true} counts={counts} />
          <div className="mt-4 md:mt-0 min-w-0">{children}</div>
        </div>
      </main>
      <BottomNav active="profile" />
    </div>
  );
}

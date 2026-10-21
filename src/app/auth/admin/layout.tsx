import React from 'react';
import { notFound } from 'next/navigation';
import AdminBar from './AdminBar';
import { getCurrentUser } from '@/lib/session';
import { adminFetch } from './adminFetch';
import AdminNav, { type AdminNavCounts } from './AdminNav';

// Hides the admin area from everyone else. The API's requireAdmin is the real guard.
// Its own top bar, without the app's ride tabs and bottom bar, so admins stay
// focused here; "Back to app" goes to the normal app.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();
  const counts = await adminFetch<AdminNavCounts>('/api/admin/nav-counts');

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <AdminBar adminName={user.fullName} />
      <main className="app-desktop w-full pt-3 md:pt-5">
        <h1 className="sr-only">Admin console</h1>
        <div className="md:grid md:grid-cols-[190px_minmax(0,1fr)] md:gap-6">
          <AdminNav isSuperAdmin={user.isSuperAdmin === true} counts={counts} />
          <div className="mt-4 md:mt-0 min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}

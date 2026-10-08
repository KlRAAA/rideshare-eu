import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import NotificationsClient, { type NotificationItem } from './NotificationsClient';

export default async function NotificationsPage() {
  const user = await getCurrentUser();

  // This mode's notifications plus account-wide ones (sub-project C).
  const mode = user?.activeMode === 'DRIVER' ? 'driver' : 'passenger';
  let notifications: NotificationItem[] = [];
  let initialNextCursor: string | null = null;
  let otherModeUnread = 0;
  if (user) {
    const data = await apiFetch<{ notifications: NotificationItem[]; nextCursor: string | null; otherModeUnread: number }>(
      `/api/alerts?mode=${mode}`
    );
    notifications = data.notifications;
    initialNextCursor = data.nextCursor;
    otherModeUnread = data.otherModeUnread ?? 0;
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="notifications" unreadCount={unreadCount} />
      <main className="app-desktop w-full pt-2 md:pt-4">
        {user ? (
          <NotificationsClient
            initialNotifications={notifications}
            initialNextCursor={initialNextCursor}
            mode={mode}
            otherModeUnread={otherModeUnread}
          />
        ) : (
          <p className="text-sm text-gray-500">Sign in to view your notifications.</p>
        )}
      </main>
      <BottomNav active="notifications" unreadCount={unreadCount} />
    </div>
  );
}

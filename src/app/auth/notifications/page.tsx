import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import NotificationsClient, { type NotificationItem } from './NotificationsClient';

export default async function NotificationsPage() {
  const user = await getCurrentUser();

  let notifications: NotificationItem[] = [];
  if (user) {
    const data = await apiFetch<{ notifications: NotificationItem[] }>(`/api/alerts?userId=${user.id}`);
    notifications = data.notifications;
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="notifications" unreadCount={unreadCount} />
      <main className="app-desktop w-full pt-2 md:pt-4">
        {user ? (
          <NotificationsClient initialNotifications={notifications} />
        ) : (
          <p className="text-sm text-gray-500">Sign in to view your notifications.</p>
        )}
      </main>
      <BottomNav active="notifications" unreadCount={unreadCount} />
    </div>
  );
}

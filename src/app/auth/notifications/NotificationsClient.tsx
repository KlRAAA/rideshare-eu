'use client';

import React, { useEffect, useState } from 'react';
import { FaUserPlus, FaCheckCircle, FaClock, FaStar, FaBan } from 'react-icons/fa';
import Card from '@/components/Card';
import { apiFetch } from '@/lib/api';
import { formatDateTimeAgo } from '@/lib/format';

export interface NotificationItem {
  id: string;
  type: 'MATCH_REQUEST' | 'APPROVAL' | 'REMINDER' | 'RATING_PROMPT' | 'CANCELLATION';
  message: string;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<NotificationItem['type'], React.ComponentType<{ className?: string }>> = {
  MATCH_REQUEST: FaUserPlus,
  APPROVAL: FaCheckCircle,
  REMINDER: FaClock,
  RATING_PROMPT: FaStar,
  CANCELLATION: FaBan,
};

export default function NotificationsClient({ initialNotifications }: { initialNotifications: NotificationItem[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [markingAll, setMarkingAll] = useState(false);
  // formatDateTimeAgo is a function of Date.now(), which genuinely differs
  // between the server-render instant and the client-hydration instant a
  // moment later — a real, deterministic hydration mismatch, not a
  // formatting quirk. Gate it behind mount so the server and first client
  // paint agree (blank), then fill in the real relative time.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markAllAsRead() {
    setMarkingAll(true);
    const unread = notifications.filter((n) => !n.isRead);
    try {
      await Promise.all(unread.map((n) => apiFetch(`/api/alerts/${n.id}/read`, { method: 'PATCH' })));
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'You’re all caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllAsRead} disabled={markingAll} className="rsu-btn-secondary disabled:opacity-60">
            {markingAll ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400 text-center py-8">No notifications yet.</p>
        </Card>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type];
            return (
              <Card key={n.id} className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    n.isRead ? 'bg-gray-100 text-gray-400' : 'bg-[color:var(--rsu-color-primary)]/10 text-[color:var(--rsu-color-primary)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{isMounted ? formatDateTimeAgo(n.createdAt) : ' '}</p>
                </div>
                {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" aria-label="Unread" />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

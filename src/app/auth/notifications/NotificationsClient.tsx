'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { shortPlace } from '@/lib/places';
import { FaUserPlus, FaCheckCircle, FaClock, FaStar, FaBan, FaPen, FaCommentDots, FaLifeRing, FaBullhorn, FaExclamationTriangle, FaBell, FaCar, FaQuestionCircle, FaUserClock, FaUserTimes, FaCalendarTimes, FaIdCard, FaMapMarkerAlt, FaGasPump } from 'react-icons/fa';
import { apiFetch } from '@/lib/api';
import ModeSwitchButton from '@/components/ModeSwitchButton';
import { formatDateTimeAgo } from '@/lib/format';
import { notificationHref } from '@/lib/notificationLink';
import { ALERTS_CHANGED } from '@/components/NotificationFeed';

const alertsChanged = () => window.dispatchEvent(new Event(ALERTS_CHANGED));

export interface NotificationItem {
  id: string;
  type:
    | 'MATCH_REQUEST'
    | 'APPROVAL'
    | 'REMINDER'
    | 'RATING_PROMPT'
    | 'CANCELLATION'
    | 'TRIP_UPDATED'
    | 'MESSAGE'
    | 'SUPPORT_REPLY'
    | 'ANNOUNCEMENT'
    | 'WARNING'
    | 'TRIP_STARTED'
    | 'CONFIRM_REQUEST'
    | 'DRIVER_UNCONFIRMED'
    | 'DRIVER_LATE'
    | 'DRIVER_NO_SHOW'
    | 'TRIP_SKIPPED'
    | 'LICENSE_APPROVED'
    | 'LICENSE_REJECTED'
    | 'LICENSE_REQUIRED'
    | 'LICENSE_EXPIRING'
    | 'DRIVER_ARRIVING'
    | 'FUEL_PRICE_CHECK';
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedTripId: string | null;
  relatedMatchId: string | null;
}

const TYPE_ICON: Record<NotificationItem['type'], React.ComponentType<{ className?: string }>> = {
  MATCH_REQUEST: FaUserPlus,
  APPROVAL: FaCheckCircle,
  REMINDER: FaClock,
  RATING_PROMPT: FaStar,
  CANCELLATION: FaBan,
  TRIP_UPDATED: FaPen,
  MESSAGE: FaCommentDots,
  SUPPORT_REPLY: FaLifeRing,
  ANNOUNCEMENT: FaBullhorn,
  WARNING: FaExclamationTriangle,
  TRIP_STARTED: FaCar,
  CONFIRM_REQUEST: FaQuestionCircle,
  DRIVER_UNCONFIRMED: FaExclamationTriangle,
  DRIVER_LATE: FaUserClock,
  DRIVER_NO_SHOW: FaUserTimes,
  TRIP_SKIPPED: FaCalendarTimes,
  LICENSE_APPROVED: FaIdCard,
  LICENSE_REJECTED: FaIdCard,
  LICENSE_REQUIRED: FaIdCard,
  LICENSE_EXPIRING: FaIdCard,
  DRIVER_ARRIVING: FaMapMarkerAlt,
  FUEL_PRICE_CHECK: FaGasPump,
};

interface NotificationsClientProps {
  initialNotifications: NotificationItem[];
  initialNextCursor: string | null;
  mode?: 'driver' | 'passenger';
  // Unread notifications waiting in the other mode (sub-project C).
  otherModeUnread?: number;
}

export default function NotificationsClient({
  initialNotifications,
  initialNextCursor,
  mode,
  otherModeUnread = 0,
}: NotificationsClientProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  // formatDateTimeAgo is a function of Date.now(), which genuinely differs
  // between the server-render instant and the client-hydration instant a
  // moment later — a real, deterministic hydration mismatch, not a
  // formatting quirk. Gate it behind mount so the server and first client
  // paint agree (blank), then fill in the real relative time.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  // NotificationFeed refreshes the page when something new arrives: add those on top.
  useEffect(() => {
    setNotifications((prev) => {
      const known = new Set(prev.map((n) => n.id));
      const fresh = initialNotifications.filter((n) => !known.has(n.id));
      return fresh.length ? [...fresh, ...prev] : prev;
    });
  }, [initialNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function markReadLocally(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  // Fire-and-forget: the row is already updated locally and we're navigating
  // away; a failed PATCH just means the dot reappears on next server load.
  function handleOpen(n: NotificationItem) {
    if (!n.isRead) {
      markReadLocally(n.id);
      apiFetch(`/api/alerts/${n.id}/read`, { method: 'PATCH' })
        .then(alertsChanged)
        .catch(() => {});
    }
  }

  async function markAllAsRead() {
    setMarkingAll(true);
    const unread = notifications.filter((n) => !n.isRead);
    try {
      await Promise.all(unread.map((n) => apiFetch(`/api/alerts/${n.id}/read`, { method: 'PATCH' })));
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } finally {
      setMarkingAll(false);
      alertsChanged();
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<{ notifications: NotificationItem[]; nextCursor: string | null }>(
        `/api/alerts?cursor=${nextCursor}${mode ? `&mode=${mode}` : ''}`
      );
      setNotifications((prev) => [...prev, ...data.notifications]);
      setNextCursor(data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllAsRead} disabled={markingAll} className="text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline disabled:opacity-60">
            {markingAll ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {otherModeUnread > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-sm text-gray-700">
            {otherModeUnread} new in {mode === 'driver' ? 'Passenger' : 'Driver'} mode
          </p>
          <ModeSwitchButton />
        </div>
      )}

      {notifications.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Nothing yet. Requests, trip updates and messages show up here.</p>
      ) : (
        // One list with dividers, not a card per alert (adviser feedback: calmer).
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {notifications.map((n) => {
            // A type added on the server before this map would otherwise crash the page.
            const Icon = TYPE_ICON[n.type] ?? FaBell;
            const href = notificationHref(n);

            const inner = (
              <>
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    n.isRead ? 'bg-gray-100 text-gray-400' : 'bg-[color:var(--rsu-color-primary)]/10 text-[color:var(--rsu-color-primary)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.isRead ? 'text-gray-600' : 'font-medium text-gray-900'}`}>
                    {!n.isRead && <span className="sr-only">Unread: </span>}
                    {shortPlace(n.message)}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">{isMounted ? formatDateTimeAgo(n.createdAt) : ' '}</span>
                </span>
                {!n.isRead && <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[color:var(--rsu-color-primary)]" />}
              </>
            );

            return (
              <li key={n.id}>
                {href ? (
                  <Link href={href} onClick={() => handleOpen(n)} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor && (
        <div className="flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className="rsu-btn-secondary disabled:opacity-60">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

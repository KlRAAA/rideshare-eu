'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaBell, FaTimes } from 'react-icons/fa';
import { apiFetch } from '@/lib/api';
import { notificationHref } from '@/lib/notificationLink';
import { shouldPopUp, soundEnabled } from '@/lib/loudNotifications';
import { useMode } from './ModeProvider';

interface FeedNotification {
  id: string;
  type: string;
  message: string;
  relatedTripId: string | null;
  relatedMatchId: string | null;
}
interface FeedResponse {
  notifications: FeedNotification[];
  unreadCount: number;
  cursor: string;
}

const POLL_MS = 20 * 1000;
const TOAST_MS = 7 * 1000;
const VIBRATION = [200, 100, 200];

// The live unread count for the header and bottom bar; null until the first poll.
const UnreadContext = createContext<number | null>(null);
export const useLiveUnread = () => useContext(UnreadContext);

// A short two-note chime, made in the browser (no audio file).
function chime(ctx: AudioContext) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.setValueAtTime(660, t + 0.15);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.32);
}

// Polls for new notifications while a signed-in page is open (sub-project F):
// keeps the badge current and announces loud ones with a pop-up, a chime and
// a vibration. Phone notifications when the app is closed come from Web Push.
export default function NotificationFeed({ children }: { children: React.ReactNode }) {
  const mode = useMode();
  const pathname = usePathname();
  const [unread, setUnread] = useState<number | null>(null);
  const [toast, setToast] = useState<FeedNotification | null>(null);
  const cursor = useRef<string | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // Browsers only allow sound after the user has interacted with the page.
  useEffect(() => {
    const unlock = () => {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      } catch {
        /* no Web Audio */
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const announce = useCallback((n: FeedNotification) => {
    setToast(n);
    if (!soundEnabled()) return;
    if (audio.current?.state === 'running') chime(audio.current);
    if ('vibrate' in navigator) navigator.vibrate(VIBRATION);
  }, []);

  const poll = useCallback(async () => {
    try {
      const q = new URLSearchParams({ mode: mode === 'DRIVER' ? 'driver' : 'passenger' });
      if (cursor.current) q.set('after', cursor.current);
      const data = await apiFetch<FeedResponse>(`/api/alerts/feed?${q}`);
      setUnread(data.unreadCount);
      const first = cursor.current === null;
      cursor.current = data.cursor;
      if (first) return; // the first poll only sets the starting point
      const loud = data.notifications.filter((n) => shouldPopUp(n, pathRef.current));
      if (loud.length) announce(loud[loud.length - 1]);
    } catch {
      /* offline or signed out: try again on the next tick */
    }
  }, [mode, announce]);

  useEffect(() => {
    cursor.current = null; // a mode switch starts a fresh feed
    void poll();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void poll();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const href = toast ? notificationHref(toast) ?? '/auth/notifications' : null;
  return (
    <UnreadContext.Provider value={unread}>
      {children}
      {toast && href && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-3 shadow-lg md:bottom-auto md:right-6 md:top-20 md:left-auto md:mx-0"
        >
          <div className="flex items-start gap-3">
            <FaBell className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--rsu-color-primary)]" aria-hidden />
            <p className="min-w-0 flex-1 text-sm text-gray-900">{toast.message}</p>
            <button type="button" aria-label="Dismiss" onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600">
              <FaTimes className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="mt-2 flex justify-end">
            <Link href={href} onClick={() => setToast(null)} className="rsu-btn-primary px-3 py-1.5 text-xs">
              Open
            </Link>
          </div>
        </div>
      )}
    </UnreadContext.Provider>
  );
}

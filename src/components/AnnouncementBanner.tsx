'use client';

import { useEffect, useState } from 'react';
import { FaBullhorn, FaTimes } from 'react-icons/fa';
import { apiFetch } from '@/lib/api';

interface Announcement {
  id: string;
  title: string;
  body: string;
}

const STORAGE_KEY = 'rsu-dismissed-announcements';

// Dismissals live in this browser only; storage can be unavailable (private
// mode, blocked site data), so every read and write is guarded.
function readDismissed(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-20)));
  } catch {
    // ignore
  }
}

// The newest admin announcement the user hasn't dismissed.
export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ announcements: Announcement[] }>('/api/announcements/active')
      .then(({ announcements }) => {
        if (cancelled) return;
        const dismissed = readDismissed();
        setAnnouncement(announcements.find((a) => !dismissed.includes(a.id)) ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement) return null;

  function dismiss() {
    if (!announcement) return;
    saveDismissed([...readDismissed(), announcement.id]);
    setAnnouncement(null);
  }

  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <FaBullhorn className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-amber-900 break-words">{announcement.title}</p>
        <p className="text-sm text-amber-900 whitespace-pre-wrap break-words">{announcement.body}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="shrink-0 rounded-full p-1 text-amber-800 hover:bg-amber-100"
      >
        <FaTimes className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

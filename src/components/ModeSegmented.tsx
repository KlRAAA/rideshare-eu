'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaCar, FaUser } from 'react-icons/fa';
import { apiFetch } from '@/lib/api';
import type { AppMode } from '@/lib/modeNav';
import { useMode } from './ModeProvider';

const OPTIONS: { mode: AppMode; label: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }> }[] = [
  { mode: 'PASSENGER', label: 'Passenger', icon: FaUser },
  { mode: 'DRIVER', label: 'Driver', icon: FaCar },
];

// "Passenger | Driver": the current mode is filled. On Home and in Profile;
// it shows which mode you're in and switches with one tap. Saves the mode on
// the account and goes to that mode's home.
export default function ModeSegmented({ className = '' }: { className?: string }) {
  const router = useRouter();
  const current = useMode();
  const [busy, setBusy] = useState<AppMode | null>(null);
  const [error, setError] = useState(false);

  async function choose(mode: AppMode) {
    if (mode === current || busy) return;
    setBusy(mode);
    setError(false);
    try {
      await apiFetch('/api/users/me/mode', { method: 'PATCH', body: JSON.stringify({ mode }) });
      router.push('/auth/dashboard');
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label="Mode"
        data-tour="mode-switch"
        className="grid grid-cols-2 gap-1 rounded-full border border-gray-200 bg-gray-100 p-1"
      >
        {OPTIONS.map(({ mode, label, icon: Icon }) => {
          const on = mode === current;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy !== null}
              onClick={() => choose(mode)}
              className={`flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rsu-color-primary)] ${
                on ? 'bg-[color:var(--rsu-color-primary)] text-white shadow-sm' : 'text-gray-600 hover:bg-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {busy === mode ? 'Switching…' : label}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          Couldn’t switch. Try again.
        </p>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaExchangeAlt } from 'react-icons/fa';
import { apiFetch } from '@/lib/api';
import { modeLabel, otherMode } from '@/lib/modeNav';
import { useMode } from './ModeProvider';

// "Switch to Driver" / "Switch to Passenger". Saves the mode on the account and
// goes to that mode's home.
export default function ModeSwitchButton({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const router = useRouter();
  const target = otherMode(useMode());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function switchMode() {
    setBusy(true);
    setError(false);
    try {
      await apiFetch('/api/users/me/mode', { method: 'PATCH', body: JSON.stringify({ mode: target }) });
      router.push('/auth/dashboard');
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={switchMode}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 ${className}`}
      >
        <FaExchangeAlt className="w-3 h-3" aria-hidden />
        {busy ? 'Switching…' : compact ? modeLabel(target) : `Switch to ${modeLabel(target)}`}
      </button>
      {error && <span className="text-[11px] text-red-600 mt-0.5">Couldn’t switch. Try again.</span>}
    </span>
  );
}

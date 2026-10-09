'use client';

import React, { useEffect, useState } from 'react';
import { FaBell, FaTimes } from 'react-icons/fa';
import { pushState, turnOffPush, turnOnPush, type PushState } from '@/lib/push';
import { setSoundEnabled, soundEnabled } from '@/lib/loudNotifications';

const DISMISS_KEY = 'rsu.pushCardDismissed';

const TEXT: Record<PushState, string> = {
  unsupported: 'This browser can’t show phone notifications. You’ll still see them here and by email for important ones.',
  'ios-install': 'On iPhone, add RideShareEU to your Home Screen first (Share → Add to Home Screen), then open it from there to turn on notifications.',
  'off-server': 'Phone notifications aren’t available yet.',
  blocked: 'Notifications are blocked for this site. Allow them in your browser’s site settings, then come back.',
  off: 'Get a notification on this phone when a driver approves you, a trip starts, or someone messages you, even when the app is closed.',
  on: 'Phone notifications are on for this device.',
};

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

interface PushCardProps {
  // Dashboard: only while off, and dismissable. Profile: always, with Turn off and the sound switch.
  placement: 'dashboard' | 'profile';
}

export default function PushCard({ placement }: PushCardProps) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [sound, setSound] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(readDismissed());
    setSound(soundEnabled());
    pushState().then(setState, () => setState('unsupported'));
  }, []);

  if (state === null) return null;
  if (placement === 'dashboard' && (dismissed || state === 'on' || state === 'off-server' || state === 'unsupported')) return null;

  async function toggle(on: boolean) {
    setBusy(true);
    setError(null);
    try {
      setState(on ? await turnOnPush() : await turnOffPush());
    } catch {
      setError('That didn’t work in this browser. Try again, or use Chrome on Android or the Home Screen app on iPhone.');
      setState(await pushState().catch(() => 'unsupported' as const));
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* shows again next time */
    }
    setDismissed(true);
  }

  return (
    <section aria-label="Notifications" className="rsu-card space-y-3">
      <div className="flex items-start gap-2">
        <FaBell className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--rsu-color-primary)]" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-bold text-gray-900">Phone notifications</h2>
          <p className="text-sm text-gray-600">{TEXT[state]}</p>
        </div>
        {placement === 'dashboard' && (
          <button type="button" aria-label="Not now" onClick={dismiss} className="text-gray-400 hover:text-gray-600">
            <FaTimes className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
      {state === 'off' && (
        <button type="button" disabled={busy} onClick={() => toggle(true)} className="rsu-btn-primary px-4 py-2 text-sm disabled:opacity-60">
          {busy ? 'Turning on…' : 'Turn on phone notifications'}
        </button>
      )}
      {state === 'on' && placement === 'profile' && (
        <button type="button" disabled={busy} onClick={() => toggle(false)} className="rsu-btn-secondary px-4 py-2 text-sm disabled:opacity-60">
          Turn off on this device
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {placement === 'profile' && (
        <label className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-sm text-gray-800">
          <span>
            Sounds and vibration
            <span className="block text-xs text-gray-500">A chime and a buzz for important updates while the app is open</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={sound}
            onChange={(e) => {
              setSound(e.target.checked);
              setSoundEnabled(e.target.checked);
            }}
            className="h-5 w-5 accent-[color:var(--rsu-color-primary)]"
          />
        </label>
      )}
    </section>
  );
}

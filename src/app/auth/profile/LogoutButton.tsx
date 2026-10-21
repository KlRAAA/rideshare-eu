'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSessionCookie } from '@/lib/api';

// Beside the Profile heading, so the name below keeps the full width.
export default function LogoutButton() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await clearSessionCookie();
    router.push('/login');
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loggingOut}
      className="min-h-9 shrink-0 rounded-lg border border-red-200 px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      {loggingOut ? 'Logging out…' : 'Log out'}
    </button>
  );
}

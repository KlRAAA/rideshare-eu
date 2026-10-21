'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaSearch } from 'react-icons/fa';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import Tip from '@/components/Tip';
import { clearSessionCookie } from '@/lib/api';

// The admin console's own top bar: no ride tabs, mode switch or trip pop-ups,
// so admins stay on admin work. "Back to app" returns to the normal app.
export default function AdminBar({ adminName, query = '' }: { adminName: string; query?: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await clearSessionCookie();
    router.push('/login');
  }

  return (
    <header className="rsu-header-bar sticky top-0 z-30 border-b border-gray-100 bg-white shadow-sm">
      <div className="app-desktop flex flex-wrap items-center gap-x-4 gap-y-2 py-2 md:h-16 md:flex-nowrap md:py-0">
        <Link href="/auth/admin" className="flex shrink-0 items-center gap-2.5">
          <Logo size={36} />
          <span className="text-base font-bold text-gray-900">Admin console</span>
        </Link>

        <form action="/auth/admin/search" role="search" className="order-last w-full md:order-none md:max-w-md md:flex-1">
          <label htmlFor="admin-search" className="sr-only">
            Search users, trips, reports, requests and licenses
          </label>
          <div className="relative">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              id="admin-search"
              name="q"
              type="search"
              defaultValue={query}
              minLength={2}
              placeholder="Search users, trips, reports…"
              className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--rsu-color-primary)] focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
            />
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden max-w-[12rem] truncate text-sm text-gray-600 lg:inline">{adminName}</span>
          <Tip label="Light or dark mode" mode="wrap" side="bottom">
            <ThemeToggle />
          </Tip>
          <Link href="/auth/dashboard" className="rsu-btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <FaArrowLeft className="h-3 w-3" aria-hidden />
            Back to app
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </div>
    </header>
  );
}

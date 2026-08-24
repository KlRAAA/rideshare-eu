'use client';

import React from 'react';
import Link from 'next/link';
import { FaCar, FaBell } from 'react-icons/fa';

export type ActiveRoute = 'dashboard' | 'trips' | 'search' | 'post' | 'notifications' | 'profile';

interface HeaderProps {
  active: ActiveRoute;
  unreadCount?: number;
}

const NAV_ITEMS: { key: ActiveRoute; href: string; label: string }[] = [
  { key: 'dashboard', href: '/auth/dashboard', label: 'Dashboard' },
  { key: 'trips', href: '/auth/trips', label: 'My Trips' },
  { key: 'notifications', href: '/auth/notifications', label: 'Notifications' },
  { key: 'profile', href: '/auth/profile', label: 'Profile' },
];

export default function Header({ active, unreadCount = 0 }: HeaderProps) {
  return (
    <header className="rsu-header-bar bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
      <div className="app-desktop h-14 md:h-16 flex items-center justify-between gap-4">
        <Link href="/auth/dashboard" className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-[color:var(--rsu-color-primary)] text-white rounded-lg flex items-center justify-center shadow header-logo-only">
            <FaCar className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-gray-900 header-title truncate">RideShareEU</span>
        </Link>

        <nav className="rsu-topnav flex-1 min-w-0 justify-end hidden md:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.key} href={item.href} className={item.key === active ? 'active' : ''}>
              <span>{item.label}</span>
              {item.key === 'notifications' && unreadCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center bg-red-600 text-white text-[10px] rounded-full px-2">
                  {unreadCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <Link
          href="/auth/notifications"
          className="md:hidden relative flex items-center justify-center w-9 h-9 text-gray-600 hover:text-gray-800"
          aria-label="Notifications"
        >
          <FaBell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

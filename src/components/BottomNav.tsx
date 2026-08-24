'use client';

import React from 'react';
import Link from 'next/link';
import { FaHome, FaCar, FaBell, FaUser } from 'react-icons/fa';
import type { ActiveRoute } from './Header';

interface BottomNavProps {
  active: ActiveRoute;
  unreadCount?: number;
}

const NAV_ITEMS = [
  { key: 'dashboard' as const, href: '/auth/dashboard', label: 'Dashboard', Icon: FaHome },
  { key: 'trips' as const, href: '/auth/trips', label: 'My Trips', Icon: FaCar },
  { key: 'notifications' as const, href: '/auth/notifications', label: 'Notifications', Icon: FaBell },
  { key: 'profile' as const, href: '/auth/profile', label: 'Profile', Icon: FaUser },
];

export default function BottomNav({ active, unreadCount = 0 }: BottomNavProps) {
  return (
    <nav className="rsu-bottom-nav md:hidden">
      {NAV_ITEMS.map(({ key, href, label, Icon }) => {
        const isActive = key === active;
        return (
          <Link key={key} href={href} className={isActive ? 'text-[color:var(--rsu-color-primary)]' : 'text-gray-400 hover:text-gray-600'}>
            <span className="relative">
              <Icon className="w-5 h-5" />
              {key === 'notifications' && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </span>
            <span className="text-xs font-medium mt-0.5">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

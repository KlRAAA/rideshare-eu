'use client';

import React from 'react';
import Link from 'next/link';
import { FaHome, FaCar, FaBell, FaUser, FaSearch, FaPlusCircle } from 'react-icons/fa';
import type { ActiveRoute } from './Header';
import { useMode } from './ModeProvider';
import { useLiveUnread } from './NotificationFeed';
import { tabsFor, type TabKey } from '@/lib/modeNav';

interface BottomNavProps {
  active: ActiveRoute;
  unreadCount?: number;
}

const ICONS: Record<TabKey, React.ComponentType<{ className?: string }>> = {
  dashboard: FaHome,
  search: FaSearch,
  post: FaPlusCircle,
  trips: FaCar,
  notifications: FaBell,
  profile: FaUser,
};

// The current mode's five tabs (sub-project C). The active tab is maroon in
// Driver mode and green in Passenger mode, so the mode is visible at a glance.
export default function BottomNav({ active, unreadCount: pageUnread = 0 }: BottomNavProps) {
  const mode = useMode();
  // The live count once the feed has polled; the page's own count until then.
  const unreadCount = useLiveUnread() ?? pageUnread;
  const activeClass = mode === 'DRIVER' ? 'text-[color:var(--rsu-color-primary)]' : 'text-emerald-700';
  return (
    <nav className="rsu-bottom-nav md:hidden">
      {tabsFor(mode).map(({ key, href, label }) => {
        const Icon = ICONS[key];
        const isActive = key === active;
        return (
          <Link key={key} href={href} className={isActive ? activeClass : 'text-gray-400 hover:text-gray-600'}>
            <span className="relative">
              <Icon className="w-5 h-5" />
              {key === 'notifications' && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </span>
            <span className="text-[11px] font-medium mt-0.5 whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

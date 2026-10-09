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

// The current mode's five tabs (sub-project C), the main action in the middle.
// Maroon in both modes; the tabs themselves and Home's mode switch show the mode.
export default function BottomNav({ active, unreadCount: pageUnread = 0 }: BottomNavProps) {
  const mode = useMode();
  // The live count once the feed has polled; the page's own count until then.
  const unreadCount = useLiveUnread() ?? pageUnread;
  const activeClass = 'text-[color:var(--rsu-color-primary)]';
  return (
    <nav className="rsu-bottom-nav md:hidden">
      {tabsFor(mode).map(({ key, href, label, primary }) => {
        const Icon = ICONS[key];
        const isActive = key === active;
        return (
          <Link key={key} href={href} className={isActive ? activeClass : 'text-gray-400 hover:text-gray-600'}>
            {/* Every icon sits in the same 32 px slot, so the labels line up. */}
            <span className="relative flex h-8 items-center justify-center">
              {primary ? (
                // The mode's main action: a filled maroon circle the size of the slot.
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--rsu-color-primary)] text-white shadow-sm">
                  <Icon className="w-3.5 h-3.5" />
                </span>
              ) : (
                <Icon className="w-5 h-5" />
              )}
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

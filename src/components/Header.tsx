'use client';

import React from 'react';
import Link from 'next/link';
import { FaBell } from 'react-icons/fa';
import Logo from './Logo';
import Wordmark from './Wordmark';
import ThemeToggle from './ThemeToggle';
import { useMode } from './ModeProvider';
import { useLiveUnread } from './NotificationFeed';
import Tip from './Tip';
import { tabsFor } from '@/lib/modeNav';

export type ActiveRoute = 'dashboard' | 'trips' | 'search' | 'post' | 'notifications' | 'profile' | 'help';

interface HeaderProps {
  active: ActiveRoute;
  unreadCount?: number;
}

const HELP: { key: ActiveRoute; href: string; label: string } = { key: 'help', href: '/help', label: 'Help' };

export default function Header({ active, unreadCount: pageUnread = 0 }: HeaderProps) {
  // Only the current mode's tabs (sub-project C), plus Help.
  const mode = useMode();
  // The live count once the feed has polled; the page's own count until then.
  const unreadCount = useLiveUnread() ?? pageUnread;
  const navItems: { key: ActiveRoute; href: string; label: string }[] = [...tabsFor(mode), HELP];
  return (
    <header
      data-tour="main-nav"
      className="rsu-header-bar bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm"
    >
      <div className="app-desktop h-14 md:h-16 flex items-center justify-between gap-4">
        <Link href="/auth/dashboard" className="flex items-center gap-3 min-w-0">
          <Logo size={40} />
          <Wordmark height={18} className="text-gray-900 shrink-0" />
        </Link>

        <nav className="rsu-topnav flex-1 min-w-0 justify-end hidden md:flex">
          {navItems.map((item) => (
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

        <div className="flex items-center gap-1.5 shrink-0">
          <Tip label="Light or dark mode" mode="wrap" side="bottom">
            <ThemeToggle />
          </Tip>
          <Tip label="Notifications" mode="wrap" side="bottom" className="md:hidden">
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
          </Tip>
        </div>
      </div>
    </header>
  );
}

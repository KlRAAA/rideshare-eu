'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/auth/admin', label: 'Overview' },
  { href: '/auth/admin/reports', label: 'Reports' },
  { href: '/auth/admin/support', label: 'Support' },
  { href: '/auth/admin/watchlist', label: 'Watch list' },
  { href: '/auth/admin/users', label: 'Users' },
  { href: '/auth/admin/announcements', label: 'Announcements' },
  { href: '/auth/admin/fuel-price', label: 'Fuel price' },
  { href: '/auth/admin/activity', label: 'Activity' },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Admin sections">
      {TABS.map((tab) => {
        const active = tab.href === '/auth/admin' ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 px-2 md:px-3 py-2 text-[13px] md:text-sm font-semibold border-b-2 -mb-px ${
              active
                ? 'border-[color:var(--rsu-color-primary)] text-[color:var(--rsu-color-primary)]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

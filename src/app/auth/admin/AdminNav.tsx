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

const DATA_REQUESTS_TAB = { href: '/auth/admin/data-requests', label: 'Data requests' };

// The data requests tab is shown only to the superadmin; the API refuses everyone else.
export default function AdminNav({ showDataRequests }: { showDataRequests: boolean }) {
  const pathname = usePathname();
  const tabs = showDataRequests ? [...TABS.slice(0, -1), DATA_REQUESTS_TAB, TABS[TABS.length - 1]] : TABS;
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Admin sections">
      {tabs.map((tab) => {
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

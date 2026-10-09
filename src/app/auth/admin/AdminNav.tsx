'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNavGroups, type AdminBadgeKey } from '@/lib/admin';

export type AdminNavCounts = Record<AdminBadgeKey, number | null>;

interface AdminNavProps {
  isSuperAdmin: boolean;
  counts: AdminNavCounts;
}

// Reports in red (someone may be at risk), everything else in amber.
const BADGE_TONE: Record<AdminBadgeKey, string> = {
  openReports: 'bg-red-50 text-red-600',
  openTickets: 'bg-amber-50 text-amber-800',
  pendingLicenses: 'bg-amber-50 text-amber-800',
  overdueDataPaperwork: 'bg-red-50 text-red-600',
};

function Badge({ kind, count }: { kind: AdminBadgeKey; count: number | null }) {
  if (!count) return null;
  return (
    <span className={`ml-2 rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${BADGE_TONE[kind]}`}>{count}</span>
  );
}

const isActive = (pathname: string, href: string) => (href === '/auth/admin' ? pathname === href : pathname.startsWith(href));

// Desktop: a sidebar grouped by job, with counts on the queues that need work.
// Phones: one scrolling row of the same items (no scrollbar arrows).
export default function AdminNav({ isSuperAdmin, counts }: AdminNavProps) {
  const pathname = usePathname();
  const groups = adminNavGroups(isSuperAdmin);
  const linkClass = (active: boolean) =>
    `flex items-center justify-between rounded-lg px-3 py-1.5 text-sm font-medium ${
      active
        ? 'bg-[color:var(--rsu-color-primary)]/10 text-[color:var(--rsu-color-primary)]'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <>
      <nav aria-label="Admin sections" className="hidden md:block">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={active ? 'page' : undefined} className={linkClass(active)}>
                      <span>{item.label}</span>
                      {item.badge && <Badge kind={item.badge} count={counts[item.badge]} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <nav
        aria-label="Admin sections"
        className="md:hidden flex gap-1 overflow-x-auto border-b border-gray-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.flatMap((g) => g.items).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 flex items-center px-2 py-2 text-[13px] font-semibold border-b-2 -mb-px ${
                active
                  ? 'border-[color:var(--rsu-color-primary)] text-[color:var(--rsu-color-primary)]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {item.label}
              {item.badge && <Badge kind={item.badge} count={counts[item.badge]} />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

import React from 'react';
import Link from 'next/link';
import Badge from './Badge';

// One bordered list, rows divided by a line (no card per trip).
export const TRIP_LIST = 'divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white';

interface TripRowProps {
  href: string;
  time: string;
  title: string;
  detail: string;
  status?: { label: string; tone: React.ComponentProps<typeof Badge>['tone'] } | null;
  // Small follow-up actions under the row (e.g. "Rate Maria").
  children?: React.ReactNode;
}

// A trip in a list, set like a timetable entry: the time first, then where and when.
export default function TripRow({ href, time, title, detail, status, children }: TripRowProps) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
        <span className="w-[4.5rem] shrink-0 font-semibold tabular-nums text-gray-900" suppressHydrationWarning>
          {time}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">{title}</span>
          <span className="block truncate text-xs text-gray-500" suppressHydrationWarning>
            {detail}
          </span>
        </span>
        {status && (
          <Badge tone={status.tone} className="shrink-0">
            {status.label}
          </Badge>
        )}
      </Link>
      {children && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 pl-[6.25rem] text-sm">{children}</div>}
    </li>
  );
}

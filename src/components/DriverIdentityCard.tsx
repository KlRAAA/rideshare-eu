import React from 'react';
import Link from 'next/link';
import { FaStar } from 'react-icons/fa';
import Card from './Card';
import Badge from './Badge';
import Avatar from './Avatar';
import { roleLabel } from '@/lib/format';

interface DriverIdentityCardProps {
  name: string;
  role: string;
  trustScore: number;
  avatarUrl?: string | null;
  // PSGA route/schedule/preference score for the viewing passenger, 0–100.
  // Omitted when the page is opened outside a search (no score to show).
  matchPercent?: number | null;
  // e.g. "You're hosting this trip" on the host's own detail view.
  note?: string;
  // When set, the avatar + name link to that user's public profile.
  href?: string;
}

export default function DriverIdentityCard({ name, role, trustScore, avatarUrl, matchPercent, note, href }: DriverIdentityCardProps) {
  const body = (
    <div className="flex items-center gap-3">
      <Avatar name={name} src={avatarUrl} sizeClass="w-12 h-12" textClass="text-lg" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900 truncate">{name}</h2>
          <Badge tone="neutral">{roleLabel(role)}</Badge>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
          <FaStar className="w-3 h-3 text-amber-400" />
          {trustScore.toFixed(1)} trust score
          {matchPercent != null && (
            <>
              <span className="text-gray-300">·</span>
              <span className="font-semibold text-emerald-600">{Math.round(matchPercent)}% match</span>
            </>
          )}
        </p>
        {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
      </div>
    </div>
  );

  return <Card>{href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body}</Card>;
}

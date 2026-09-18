import React from 'react';
import { notFound } from 'next/navigation';
import { FaStar } from 'react-icons/fa';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BackButton from '@/components/BackButton';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import Avatar from '@/components/Avatar';
import ReportUserButton from '@/components/ReportUserButton';
import { apiFetch } from '@/lib/api-server';
import { ApiError } from '@/lib/api';
import { formatDate, roleLabel } from '@/lib/format';

interface PublicUser {
  id: string;
  fullName: string;
  role: string;
  avatarUrl: string | null;
  verified: boolean;
  trustScore: number;
  tripsHosted: number;
  tripsJoined: number;
  // Only true post-match (a Match row links the viewer and this user, in
  // either host/passenger direction) — same gate the create-report endpoint
  // itself enforces, computed server-side in userController.getById.
  canReport: boolean;
}

interface Review {
  score: number;
  comment: string | null;
  createdAt: string;
  raterDisplayName: string | null;
}

function Stars({ score }: { score: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <FaStar key={n} className={`w-3.5 h-3.5 ${score >= n ? 'text-amber-400' : 'text-gray-200'}`} />
      ))}
    </span>
  );
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let user: PublicUser;
  try {
    const data = await apiFetch<{ user: PublicUser }>(`/api/users/${id}`);
    user = data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { count, ratings } = await apiFetch<{ trustScore: number; count: number; ratings: Review[] }>(
    `/api/users/${id}/ratings`
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="profile" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <BackButton fallback="/auth/dashboard" className="mb-3" />
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{user.fullName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Public profile</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Card className="text-center">
              <div className="w-16 h-16 mx-auto mb-3">
                <Avatar name={user.fullName} src={user.avatarUrl} sizeClass="w-16 h-16" textClass="text-xl" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{user.fullName}</h2>
              <div className="flex justify-center mt-1">
                <Badge tone="neutral">{roleLabel(user.role)}</Badge>
              </div>
              <p className="text-sm font-semibold text-gray-800 mt-3">
                ★ {user.trustScore.toFixed(1)} <span className="text-gray-400 font-normal">/5.0</span>
              </p>
              {user.verified && (
                <div className="mt-3 flex justify-center">
                  <Badge tone="success">Verified University Member</Badge>
                </div>
              )}
              {user.canReport && (
                <div className="mt-4 flex justify-center">
                  <ReportUserButton userId={user.id} userName={user.fullName} />
                </div>
              )}
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-gray-900 mb-3">Activity Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Trips Hosted</span>
                <span className="font-semibold text-gray-900">{user.tripsHosted}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-500">Trips Joined</span>
                <span className="font-semibold text-gray-900">{user.tripsJoined}</span>
              </div>
            </Card>
          </div>

          <Card>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Reviews ({count})</h3>
            {ratings.length === 0 ? (
              <p className="text-xs text-gray-400">No reviews yet.</p>
            ) : (
              <ul className="space-y-2">
                {ratings.map((r, i) => (
                  <li key={i} className="p-2 rounded-lg border bg-gray-50 border-gray-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Stars score={r.score} />
                      <span className="text-[11px] text-gray-400" suppressHydrationWarning>
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                    {r.comment && <p className="text-xs text-gray-600">{r.comment}</p>}
                    <p className="text-[11px] font-medium text-gray-500">
                      {r.raterDisplayName ?? 'Anonymous rider'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </main>
      <BottomNav active="profile" />
    </div>
  );
}

import 'server-only';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { apiFetch } from './api-server';
import { ApiError } from './api';

const COOKIE_NAME = 'rsu_session';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'FACULTY' | 'STAFF';
  universityId: string;
  avatarUrl: string | null;
  trustScore: number;
  tripCount: number;
  verified: boolean;
  tripsHosted: number;
  tripsJoined: number;
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return payload.userId;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  try {
    const { user } = await apiFetch<{ user: CurrentUser }>(`/api/users/${userId}`);
    return user;
  } catch {
    return null;
  }
}

export interface SuspensionDetails {
  bannedUntil: string;
  banReason: string | null;
  banSeverity: string | null;
  permanent: boolean;
}

// Distinguishes "banned" from every other reason getCurrentUser can fail (no
// session, a transient error, a deleted account) — those all return null from
// getCurrentUser and the caller falls back to its existing "not logged in"
// handling; only a genuine 403 ACCOUNT_SUSPENDED body is surfaced here. Kept
// as its own function rather than changing getCurrentUser's return shape,
// since 8+ pages already call getCurrentUser expecting CurrentUser | null.
export async function getSuspension(): Promise<SuspensionDetails | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  try {
    await apiFetch(`/api/users/${userId}`);
    return null;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'ACCOUNT_SUSPENDED' && err.body) {
      const body = err.body as Record<string, unknown>;
      return {
        bannedUntil: String(body.bannedUntil),
        banReason: (body.banReason as string) ?? null,
        banSeverity: (body.banSeverity as string) ?? null,
        permanent: body.permanent === true,
      };
    }
    return null;
  }
}

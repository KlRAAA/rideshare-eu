import 'server-only';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { apiFetch } from './api-server';

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

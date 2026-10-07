import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'rsu_session';

// Only the app's own pages may set or clear the session. A cross-site form can
// post here (text/plain, no preflight) and would otherwise sign the visitor
// into the attacker's account. Requiring JSON forces a CORS preflight, which
// this route never approves; the Origin check covers browsers that send one.
function fromThisSite(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!fromThisSite(req)) return NextResponse.json({ error: 'CROSS_SITE_REQUEST' }, { status: 403 });
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'JSON_REQUIRED' }, { status: 415 });
  }
  const { token } = await req.json().catch(() => ({ token: null }));
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'MISSING_TOKEN' }, { status: 400 });
  }
  try {
    jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] });
  } catch {
    return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days, matches the JWT's own expiry (Task 3)
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  if (!fromThisSite(req)) return NextResponse.json({ error: 'CROSS_SITE_REQUEST' }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}

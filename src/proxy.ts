import { NextRequest, NextResponse } from 'next/server';

// Nonce-based CSP, per this Next.js version's own bundled guide
// (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md) —
// this file must be named `proxy.ts`, not `middleware.ts`; that rename is
// exactly the kind of breaking change AGENTS.md warns training data won't
// know about. A fresh nonce per request lets script-src drop 'unsafe-inline'
// entirely (Next.js auto-applies the nonce to its own hydration/runtime
// scripts once it sees one in the CSP header; the Umami <Script> in
// layout.tsx gets it explicitly via the nonce prop).
//
// style-src deliberately does NOT get a nonce, and keeps plain 'unsafe-inline'
// unconditionally (not just dev) — verified live, not assumed: putting a
// nonce on style-src made Chrome drop 'unsafe-inline' entirely per the CSP3
// spec ("unsafe-inline is ignored if a nonce or hash is present"), which then
// blocked 100+ legitimate inline styles Mapbox GL JS sets at runtime via
// plain `el.style.x = y` (marker positioning, canvas sizing, control
// layout) — that's the library's own internals, not this app's code, and
// there is no nonce mechanism for JS-applied inline styles at all, so no
// amount of refactoring this codebase fixes it. Locking down script-src is
// the security-meaningful half anyway (arbitrary script execution vs.
// arbitrary CSS), so this is the standard, accepted trade-off rather than a
// gap — same reasoning most CSP guides give for map-heavy or canvas-heavy
// apps.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';
  const apiOrigin = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com;
    worker-src 'self' blob:;
    connect-src 'self' ${apiOrigin} https://api.mapbox.com https://events.mapbox.com https://cloud.umami.is https://gateway.umami.is https://*.ingest.us.sentry.io;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  `
    .replace(/\s{2,}/g, ' ')
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
}

// Excludes static assets and prefetches, per the same guide — they don't
// need a per-request nonce and forcing them dynamic would just add overhead.
export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

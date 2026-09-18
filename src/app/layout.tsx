import React from 'react';
import type { Viewport } from 'next';
import Script from 'next/script';
import { headers } from 'next/headers';
import './globals.css';

export const metadata = {
  title: 'RideShareEU | MSEUF Carpooling',
  description: 'Priority-Scored Greedy Matching Algorithm for Optimizing Schedule-Based University Carpooling',
};

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Set by src/proxy.ts on every request. Reading it here (a) gets the
  // per-request nonce to the Umami <Script> below and (b) itself forces this
  // layout to render dynamically, which nonce-based CSP requires — no
  // separate `await connection()` needed, headers() already does that.
  const nonce = (await headers()).get('x-nonce');

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-gray-50 text-gray-900">
        {/* Umami page-view analytics. A website id is a public identifier
            meant to be embedded in client code, same as a Sentry DSN, so
            hardcoding it here matches this repo's existing convention rather
            than needing its own env var. afterInteractive matches the raw
            snippet's `defer` behavior — loads without blocking initial render.
            integrity pins the exact script Umami served when this hash was
            computed (openssl dgst -sha384) — the real trade-off: if Umami
            ever updates script.js, the hash stops matching and the browser
            refuses to run it at all (silently, no visible error), so
            analytics would just stop until someone notices and recomputes
            this. That's the accepted cost of SRI on a third-party CDN
            script with no version in its URL, not a bug. */}
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="995d9cc8-d6d2-43cb-b194-1642404581b0"
          integrity="sha384-Tj9oEUiYIxX/hfR7mn1IWl784aSOveAhXJuDPo5xVUMw5HZanvI1nSmQWHwvfXn0"
          crossOrigin="anonymous"
          strategy="afterInteractive"
          nonce={nonce ?? undefined}
        />
        {children}
      </body>
    </html>
  );
}
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

  // Kept in one place and mirrored exactly by ThemeToggle.tsx's own
  // getCurrentTheme() — same storage key, same fallback order.
  const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('rsu-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-gray-50 text-gray-900">
        {/* Sets data-theme on <html> synchronously, before Next hydrates or
            paints anything else — this is what prevents a flash of the
            wrong theme on load. strategy="beforeInteractive" is next/script's
            purpose-built mechanism for this: a raw <script> tag here (even
            via dangerouslySetInnerHTML) works for the initial HTML but then
            crashes the moment React tries to reconcile it client-side
            ("Scripts inside React components are never executed when
            rendering on the client") — caught by actually reloading the page
            and reading the console, not assumed from the code. Needs the
            same nonce as every other script under the nonce-strict CSP in
            src/proxy.ts; without it the browser would silently refuse to run
            it and the app would just fall back to always-light with no error. */}
        <Script id="theme-init" strategy="beforeInteractive" nonce={nonce ?? undefined}>
          {THEME_SCRIPT}
        </Script>
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
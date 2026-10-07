import React from 'react';
import Script from 'next/script';
import { headers } from 'next/headers';
import './globals.css';

export const metadata = {
  title: 'RideShareEU | MSEUF Carpooling',
  description: 'Priority-Scored Greedy Matching Algorithm for Optimizing Schedule-Based University Carpooling',
};

// No viewport-fit: 'cover' here (on purpose, not an oversight — it used to be
// set, for Header/BottomNav's env(safe-area-inset-*) padding to clear an
// iPhone notch/home-indicator). 'cover' tells the browser the page will
// handle its own safe-area insets and lets content render full-bleed behind
// system UI. iOS Safari's insets are real and non-zero under a notch, so that
// worked there -- but Android has no equivalent concept of "safe area" for
// its address bar the way iOS does for a notch, so env(safe-area-inset-top)
// reports 0 on Android regardless, and 'cover' still tells Chrome to render
// the page edge-to-edge -- the header ends up drawn at literal y=0 of the
// physical screen, underneath Chrome's own address bar, with no CSS-visible
// signal that anything is covering it. Confirmed from a real phone
// screenshot: the header (logo, brand name, every nav control) sat mostly
// hidden behind the address bar, effectively untappable.
// The default (unset) viewport-fit is 'auto': the browser keeps the page
// inside the safe area itself and reserves the notch/home-indicator/address-
// bar space automatically, on every platform, with no per-page math needed --
// strictly safer than doing it by hand for a benefit ('cover') that was
// costing real usability on Android.

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
            No integrity hash: Umami updates script.js in place (no version in
            the URL), and a pinned hash silently stopped analytics when it did
            (Oct 2026). The nonce-strict CSP in src/proxy.ts still decides
            what may run. */}
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="995d9cc8-d6d2-43cb-b194-1642404581b0"
          strategy="afterInteractive"
          nonce={nonce ?? undefined}
        />
        {children}
      </body>
    </html>
  );
}
import React from 'react';
import type { Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata = {
  title: 'RideShareEU | MSEUF Carpooling',
  description: 'Priority-Scored Greedy Matching Algorithm for Optimizing Schedule-Based University Carpooling',
};

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-gray-50 text-gray-900">
        {/* Umami page-view analytics. A website id is a public identifier
            meant to be embedded in client code, same as a Sentry DSN, so
            hardcoding it here matches this repo's existing convention rather
            than needing its own env var. afterInteractive matches the raw
            snippet's `defer` behavior — loads without blocking initial render. */}
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="995d9cc8-d6d2-43cb-b194-1642404581b0"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}
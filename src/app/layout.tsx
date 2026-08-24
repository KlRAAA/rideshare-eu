import React from 'react';
import type { Viewport } from 'next';
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
        {children}
      </body>
    </html>
  );
}
import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Logo from '@/components/Logo';
import Wordmark from '@/components/Wordmark';
import { ModeProvider } from '@/components/ModeProvider';
import { getCurrentUser } from '@/lib/session';

interface HelpShellProps {
  signedIn: boolean;
  children: React.ReactNode;
}

// The Help pages are public, so a signed-out visitor gets a plain top bar
// instead of the app's navigation.
export default async function HelpShell({ signedIn, children }: HelpShellProps) {
  if (signedIn) {
    // Outside /auth, so it provides the mode itself (sub-project C).
    const user = await getCurrentUser();
    return (
      <ModeProvider mode={user?.activeMode ?? 'PASSENGER'}>
        <div className="min-h-screen bg-gray-50 pb-24">
          <Header active="help" />
          <main className="app-desktop w-full pt-2 md:pt-4 max-w-3xl">{children}</main>
          <BottomNav active="profile" />
        </div>
      </ModeProvider>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="app-desktop h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={36} />
            <Wordmark height={16} className="text-gray-900" />
          </Link>
          <Link href="/login" className="text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
            Sign in
          </Link>
        </div>
      </header>
      <main className="app-desktop w-full py-6 max-w-3xl">{children}</main>
    </div>
  );
}

import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser, getSessionUserId, getSuspension } from '@/lib/session';
import { ModeProvider } from '@/components/ModeProvider';
import BannedScreen from '@/components/BannedScreen';
import NotificationFeed from '@/components/NotificationFeed';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect('/login');
  }

  // Checked here, once, for every page under /auth — a banned user sees this
  // instead of the normal app shell no matter which page they land on,
  // without each of the ~9 pages under here needing its own check.
  const suspension = await getSuspension();
  if (suspension) {
    const appealEmail = process.env.REPORT_APPEAL_EMAIL || 'support@rideshareeu.local';
    return <BannedScreen suspension={suspension} appealEmail={appealEmail} />;
  }

  // Driver or Passenger mode (sub-project C), for the header, bottom bar and pages.
  const user = await getCurrentUser();
  // The live badge, pop-ups, sound and vibration (sub-project F).
  return (
    <ModeProvider mode={user?.activeMode ?? 'PASSENGER'}>
      <NotificationFeed>{children}</NotificationFeed>
    </ModeProvider>
  );
}

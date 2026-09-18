import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUserId, getSuspension } from '@/lib/session';
import BannedScreen from '@/components/BannedScreen';

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

  return <>{children}</>;
}

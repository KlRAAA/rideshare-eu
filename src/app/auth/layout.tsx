import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/session';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect('/login');
  }

  return <>{children}</>;
}

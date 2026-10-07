import React from 'react';
import HelpShell from '@/app/help/HelpShell';
import BackButton from '@/components/BackButton';

// Version shown on /terms and /privacy. Change it whenever either text changes
// materially, together with CURRENT_TERMS_VERSION in
// server/controllers/authController.js (stamped on each new account).
export const LEGAL_VERSION = '7 October 2026';

interface LegalDocumentProps {
  title: string;
  signedIn: boolean;
  intro: React.ReactNode;
  children: React.ReactNode;
}

export default function LegalDocument({ title, signedIn, intro, children }: LegalDocumentProps) {
  return (
    <HelpShell signedIn={signedIn}>
      <BackButton fallback="/" className="mb-3" />
      <article className="rsu-card space-y-5 text-sm text-gray-700 leading-relaxed">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500">Effective {LEGAL_VERSION}</p>
        </header>
        <div className="space-y-2">{intro}</div>
        {children}
      </article>
    </HelpShell>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

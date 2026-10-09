import React from 'react';
import Link from 'next/link';
import { FaIdCard } from 'react-icons/fa';
import { licenseStatusText, type MyLicense } from '@/lib/license';

const TONE = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  neutral: 'border-gray-200 bg-white text-gray-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
  bad: 'border-red-200 bg-red-50 text-red-900',
};

interface LicenseStatusCardProps {
  my: MyLicense;
  // Shown as a link to the license page (Profile, Post a Trip); omitted on that page itself.
  linkLabel?: string;
}

// Where the driver's license stands (sub-project E).
export default function LicenseStatusCard({ my, linkLabel }: LicenseStatusCardProps) {
  const { title, detail, tone } = licenseStatusText(my);
  return (
    <section aria-label="Driver's license" className={`rounded-2xl border p-4 space-y-2 ${TONE[tone]}`}>
      <p className="flex items-center gap-2 text-sm font-bold">
        <FaIdCard className="w-4 h-4" aria-hidden />
        {title}
      </p>
      <p className="text-sm">{detail}</p>
      {linkLabel && (
        <Link href="/auth/license" className="rsu-btn-secondary inline-block px-3 py-1.5 text-xs">
          {linkLabel}
        </Link>
      )}
    </section>
  );
}

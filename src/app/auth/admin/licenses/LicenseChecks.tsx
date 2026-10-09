import React from 'react';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { checkRows, type LicenseCheckResults } from '@/lib/license';

// The automatic check's five results, for the admin.
export default function LicenseChecks({ checks }: { checks: LicenseCheckResults | null | undefined }) {
  const rows = checkRows(checks);
  if (!rows) return <p className="text-xs text-gray-500">Automatic check not run yet.</p>;
  return (
    <ul className="space-y-1 text-xs" aria-label="Automatic check">
      {rows.map((r) => (
        <li key={r.label} className={`flex items-center gap-1.5 ${r.ok ? 'text-gray-700' : 'font-semibold text-red-700'}`}>
          {r.ok ? <FaCheckCircle className="h-3 w-3 text-gray-500" aria-hidden /> : <FaTimesCircle className="h-3 w-3" aria-hidden />}
          <span className="sr-only">{r.ok ? 'Passed:' : 'Failed:'}</span>
          {r.label}
        </li>
      ))}
    </ul>
  );
}

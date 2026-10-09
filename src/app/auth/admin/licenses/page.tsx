import Card from '@/components/Card';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import LicenseReviewCard, { type PendingLicense } from './LicenseReviewCard';
import LicenseChecks from './LicenseChecks';
import RevokeLicense from './RevokeLicense';
import { API_BASE } from '@/lib/api';
import { formatDateTime } from '@/lib/admin';
import { longDate, type LicenseCheckResults } from '@/lib/license';

interface AutoApproved {
  id: string;
  licenseNumber: string | null;
  expiresOn: string;
  decidedAt: string;
  photoKeepUntil: string;
  checks: LicenseCheckResults | null;
  user: { id: string; fullName: string; universityId: string };
}

// Driver licenses waiting for a decision, oldest first (sub-project E).
export default async function AdminLicensesPage() {
  const [{ licenses }, { licenses: recent }] = await Promise.all([
    adminFetch<{ licenses: PendingLicense[] }>('/api/admin/licenses'),
    adminFetch<{ licenses: AutoApproved[] }>('/api/admin/licenses/recent-auto'),
  ]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Licenses whose photo passes every automatic check are approved on their own. The ones here failed a check or
        couldn’t be read: compare the photo with the account and the typed details. The photo is deleted as soon as you
        decide.
      </p>
      {licenses.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500">No licenses waiting.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {licenses.map((l) => (
            <li key={l.id}>
              <LicenseReviewCard license={l} />
            </li>
          ))}
        </ul>
      )}
      <section className="space-y-3 pt-4">
        <h2 className="text-sm font-bold text-gray-900">Approved automatically (last 7 days)</h2>
        <p className="text-sm text-gray-500">
          Spot-check a few. Each photo is kept for 7 days, then deleted. Revoke an approval if something is wrong.
        </p>
        {recent.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">No automatic approvals in the last 7 days.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {recent.map((l) => (
              <li key={l.id} className="rsu-card grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API_BASE}/api/admin/licenses/${l.id}/photo`}
                  alt={`Driver's license approved for ${l.user.fullName}`}
                  className="w-full rounded-xl border border-gray-200 bg-gray-100 object-contain max-h-64"
                />
                <div className="space-y-2 min-w-0 text-sm">
                  <p className="font-semibold text-gray-900">{l.user.fullName}</p>
                  <p className="text-gray-600">
                    {l.user.universityId} · <span className="font-mono">{l.licenseNumber ?? '—'}</span> · expires {longDate(l.expiresOn)}
                  </p>
                  <p className="text-xs text-gray-500">Approved {formatDateTime(l.decidedAt)} · photo kept until {formatDateTime(l.photoKeepUntil)}</p>
                  <LicenseChecks checks={l.checks} />
                  <RevokeLicense licenseId={l.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

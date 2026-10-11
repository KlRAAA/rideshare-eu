import Card from '@/components/Card';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import LicenseReviewCard, { type PendingLicense } from './LicenseReviewCard';
import AutoApprovedCard, { type AutoApproved } from './AutoApprovedCard';

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
        couldn’t be read: open one and compare the photo with the account and the typed details. The photo is deleted as
        soon as you decide.
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
          Spot-check a few. “Looks right” deletes the photo at once and removes it from this list for every admin;
          otherwise it’s deleted after 7 days. Revoke an approval if something is wrong.
        </p>
        {recent.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">Nothing left to spot-check.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {recent.map((l) => (
              <li key={l.id}>
                <AutoApprovedCard license={l} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

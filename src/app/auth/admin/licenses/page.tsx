import Card from '@/components/Card';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import LicenseReviewCard, { type PendingLicense } from './LicenseReviewCard';

// Driver licenses waiting for a decision, oldest first (sub-project E).
export default async function AdminLicensesPage() {
  const { licenses } = await adminFetch<{ licenses: PendingLicense[] }>('/api/admin/licenses');

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Check that the photo is a driver’s license, that the name matches the account, and that the number and expiry date
        match what the driver typed. The photo is deleted as soon as you decide.
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
    </div>
  );
}

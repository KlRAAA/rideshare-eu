import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import DataRequestForm from './DataRequestForm';

export const metadata = { title: 'New data request | RideShareEU' };

export default async function NewDataRequestPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) notFound();
  return (
    <div className="space-y-4">
      <Link href="/auth/admin/data-requests" className="text-sm text-gray-500 hover:text-gray-700">
        ← Data requests
      </Link>
      <div>
        <h2 className="text-lg font-bold text-gray-900">New data request</h2>
        <p className="text-sm text-gray-500">
          Follow the data request policy: verify the request first, and release only the person and dates it names.
        </p>
      </div>
      <DataRequestForm />
    </div>
  );
}

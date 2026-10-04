import Link from 'next/link';
import { FaPhoneAlt, FaFlag, FaLifeRing } from 'react-icons/fa';
import Card from '@/components/Card';
import { getCurrentUser } from '@/lib/session';
import { campusSecurityPhone } from '@/lib/support';
import HelpShell from './HelpShell';
import ContactAdminForm from './ContactAdminForm';

export const metadata = { title: 'Help | RideShareEU' };

export default async function HelpPage() {
  const user = await getCurrentUser();
  const campusPhone = campusSecurityPhone();

  return (
    <HelpShell signedIn={Boolean(user)}>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Help</h1>
        <p className="text-sm text-gray-500 mt-0.5">Get help with RideShareEU or reach an admin</p>
      </div>

      <div className="space-y-4">
        <section
          aria-labelledby="emergency-heading"
          className="rounded-2xl border-2 border-red-300 bg-red-50 p-5"
        >
          <h2 id="emergency-heading" className="flex items-center gap-2 text-base font-bold text-red-800">
            <FaPhoneAlt className="w-4 h-4" aria-hidden /> In an emergency
          </h2>
          <p className="mt-2 text-sm text-red-900">
            If you or someone else is in danger, call <strong className="text-lg">911</strong> now or go to the nearest
            police station.
          </p>
          {campusPhone && (
            <p className="mt-1 text-sm text-red-900">
              Campus security: <strong>{campusPhone}</strong>
            </p>
          )}
          <p className="mt-2 text-xs text-red-800">
            RideShareEU admins can&apos;t respond to emergencies. Use the form below only for things that can wait.
          </p>
        </section>

        <Card>
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <FaFlag className="w-3.5 h-3.5 text-gray-500" aria-hidden /> Report a rider
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            To report someone you rode with, open the trip or their profile and choose <strong>Report</strong>. Reports go
            straight to the admins and can lead to a suspension.
          </p>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <FaLifeRing className="w-3.5 h-3.5 text-gray-500" aria-hidden /> Contact admin
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Problems with the app, your account, a fuel share disagreement, or a safety worry that isn&apos;t an emergency.
          </p>
          {user ? (
            <>
              <ContactAdminForm />
              <Link
                href="/help/requests"
                className="mt-4 inline-block text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
              >
                My requests →
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm">
              <Link href="/login" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
                Sign in
              </Link>{' '}
              to contact an admin and see their replies.
            </p>
          )}
        </Card>
      </div>
    </HelpShell>
  );
}

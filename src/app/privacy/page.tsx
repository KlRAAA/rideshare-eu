import Link from 'next/link';

// Placeholder — the real Privacy Policy text isn't written yet. This route
// exists so registration's consent checkbox links somewhere real rather than
// a dead link, and so accepting it at signup is linked to actual content
// under version control, not just a promise.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="rsu-card space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-500">
            This page is a placeholder. The full Privacy Policy for RideShareEU — covering what data is
            collected, how it is used, who can see it, and how to request deletion — will be published
            here before launch, consistent with Republic Act 10173 (Data Privacy Act of 2012).
          </p>
          <p className="text-sm text-gray-500">
            Registering for RideShareEU means accepting this policy once it is finalized here.
          </p>
          <Link href="/register" className="text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
            &larr; Back to registration
          </Link>
        </div>
      </div>
    </div>
  );
}

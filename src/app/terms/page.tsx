import Link from 'next/link';

// Placeholder — the real Terms of Use text isn't written yet. This route
// exists so registration's consent checkbox links somewhere real rather than
// a dead link, and so accepting it at signup is linked to actual content
// under version control, not just a promise.
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="rsu-card space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Terms of Use</h1>
          <p className="text-sm text-gray-500">
            This page is a placeholder. The full Terms of Use for RideShareEU — covering eligibility,
            acceptable use, and account rules — will be published here before launch.
          </p>
          <p className="text-sm text-gray-500">
            Registering for RideShareEU means accepting these terms once they are finalized here.
          </p>
          <Link href="/register" className="text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
            &larr; Back to registration
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaTrashAlt } from 'react-icons/fa';
import { apiFetch, ApiError, clearSessionCookie } from '@/lib/api';

const ERRORS: Record<string, string> = {
  PASSWORD_REQUIRED: 'Enter your password to confirm.',
  INVALID_PASSWORD: 'That password is incorrect.',
  LAST_ADMIN: 'You are the only admin. Make someone else an admin first, then delete your account.',
  TOO_MANY_REQUESTS: 'Too many attempts. Wait a few minutes, then try again.',
};

export default function DeleteAccountPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/users/me', { method: 'DELETE', body: JSON.stringify({ password }) });
      await clearSessionCookie();
      router.replace('/login?deleted=1');
    } catch (err) {
      setError((err instanceof ApiError && err.code && ERRORS[err.code]) || 'Couldn’t delete your account. Try again in a moment.');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-semibold text-red-600 hover:underline mt-3"
      >
        <FaTrashAlt className="w-3.5 h-3.5" />
        Delete account
      </button>
    );
  }

  return (
    <form onSubmit={confirmDelete} className="mt-3 rounded-xl border border-red-200 p-3 space-y-2">
      <p className="text-sm font-semibold text-gray-900">Delete your account?</p>
      <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
        <li>Your name, email, university ID, photo, saved cars, preferences, notifications and chat messages are erased.</li>
        <li>Trips you are hosting are cancelled, and seats you hold on other trips are released. Everyone affected is notified.</li>
        <li>Past trips and ratings stay in other people&apos;s history as &quot;Deleted user&quot;, and safety reports are kept.</li>
        <li>This can&apos;t be undone. You can register again later with the same school email.</li>
      </ul>
      <label htmlFor="delete-account-password" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
        Your password
      </label>
      <input
        id="delete-account-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-300"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || password === ''}
          className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setPassword('');
            setError(null);
          }}
          className="rsu-btn-secondary flex-1 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

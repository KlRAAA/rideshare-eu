'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaCar, FaEnvelope, FaLock } from 'react-icons/fa';
import { apiFetch, ApiError, setSessionCookie } from '@/lib/api';

interface LoginResponse {
  token: string;
  user: { id: string; email: string; fullName: string; role: string };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { token } = await apiFetch<LoginResponse>('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await setSessionCookie(token);
      router.push('/auth/dashboard');
    } catch (err) {
      // The server deliberately returns the same INVALID_CREDENTIALS for an
      // unknown email as for a wrong password (see authController.js's
      // login) — a status-code oracle for account existence was fixed there,
      // so this can no longer distinguish the two cases to show a tailored
      // "no account yet" message either. The persistent "Create one" link
      // below the form (not conditional on this error, unlike before) covers
      // a new user who mistyped their email or never registered.
      if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
        setError('That email and password don’t match. Check your password and try again.');
      } else {
        setError('Something went wrong reaching the server. Try again in a moment.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-[color:var(--rsu-color-primary)] text-white rounded-2xl flex items-center justify-center shadow-md mb-4">
            <FaCar className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">RideShareEU</h1>
          <p className="text-sm text-gray-500 mt-1">Enverga University Carpool Network</p>
        </div>

        <div className="rsu-card">
          <h2 className="text-lg font-bold text-gray-900">Login to Your Account</h2>
          <p className="text-sm text-gray-500 mt-1 mb-5">Use your verified school credentials to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                School Email
              </label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="e.g., A00-00000@student.mseuf.edu.ph"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">Your role will be automatically detected from your school credentials.</p>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button type="submit" disabled={loading} className="rsu-btn-primary w-full disabled:opacity-60">
              {loading ? 'Verifying...' : 'Verify with School Credentials'}
            </button>
          </form>

          <p className="text-center mt-4">
            <Link href="/forgot-password" className="text-xs text-[color:var(--rsu-color-primary)] font-semibold hover:underline">
              Forgot password?
            </Link>
          </p>
          <p className="text-center mt-2 text-xs text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
              Create one
            </Link>
          </p>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">For verified university community members only.</p>
      </div>
    </div>
  );
}

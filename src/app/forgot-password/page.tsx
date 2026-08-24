'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaCar, FaEnvelope, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import OtpInput from '@/components/OtpInput';
import { apiFetch, ApiError } from '@/lib/api';

type Step = 'EMAIL' | 'OTP' | 'PASSWORD';

const RESEND_COOLDOWN_SECONDS = 60;

function ErrorMessage({ code }: { code: string | undefined }) {
  const messages: Record<string, string> = {
    NO_PENDING_OTP: 'That code has expired. Send a new one.',
    OTP_EXPIRED: 'That code has expired. Send a new one.',
    INVALID_OTP: 'That code is incorrect. Check the 6 digits and try again.',
    TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Send a new code.',
    INVALID_OR_EXPIRED_TICKET: 'Your verification expired. Start again with your email.',
    PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
  };
  return <p className="text-xs text-red-600">{messages[code ?? ''] ?? 'Something went wrong reaching the server. Try again in a moment.'}</p>;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetTicket, setResetTicket] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Backend responds identically whether or not the account exists, so the
  // UI never branches on that either — always advances to the OTP step with
  // the same message, by design (see authController.requestPasswordReset).
  async function requestOtp(addr: string) {
    setLoading(true);
    setErrorCode(undefined);
    try {
      await apiFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: addr }) });
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStep('OTP');
    } catch (err) {
      setErrorCode(err instanceof ApiError ? err.code : undefined);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    await requestOtp(email);
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorCode(undefined);
    try {
      const { resetTicket: ticket } = await apiFetch<{ resetTicket: string }>('/api/auth/verify-reset-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });
      setResetTicket(ticket);
      setStep('PASSWORD');
    } catch (err) {
      setErrorCode(err instanceof ApiError ? err.code : undefined);
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorCode('PASSWORD_MISMATCH');
      return;
    }
    setLoading(true);
    setErrorCode(undefined);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ resetTicket, password }),
      });
      router.push('/login');
    } catch (err) {
      setErrorCode(err instanceof ApiError ? err.code : undefined);
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
          {step === 'EMAIL' && (
            <>
              <h2 className="text-lg font-bold text-gray-900">Reset Your Password</h2>
              <p className="text-sm text-gray-500 mt-1 mb-5">Enter your school email and we&apos;ll send a verification code</p>
              <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                {errorCode && <ErrorMessage code={errorCode} />}
                <button type="submit" disabled={loading} className="rsu-btn-primary w-full disabled:opacity-60">
                  {loading ? 'Sending code...' : 'Send Verification Code'}
                </button>
              </form>
            </>
          )}

          {step === 'OTP' && (
            <>
              <h2 className="text-lg font-bold text-gray-900">Check Your Email</h2>
              <p className="text-sm text-gray-500 mt-1 mb-5">
                If an account exists for {email}, we sent a 6-digit code to it.
              </p>
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Verification Code
                  </label>
                  <OtpInput value={otp} onChange={setOtp} disabled={loading} />
                </div>
                {errorCode && <ErrorMessage code={errorCode} />}
                <button type="submit" disabled={loading || otp.length !== 6} className="rsu-btn-primary w-full disabled:opacity-60">
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>
              </form>
              <div className="flex items-center justify-between mt-4 text-xs">
                <button type="button" onClick={() => setStep('EMAIL')} className="text-gray-500 hover:underline">
                  Change email
                </button>
                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={() => requestOtp(email)}
                  className="text-[color:var(--rsu-color-primary)] font-semibold hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
                </button>
              </div>
            </>
          )}

          {step === 'PASSWORD' && (
            <>
              <h2 className="text-lg font-bold text-gray-900">Set a New Password</h2>
              <p className="text-sm text-gray-500 mt-1 mb-5">Your code is verified — choose a new password</p>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[color:var(--rsu-color-primary)] w-4 h-4 flex items-center justify-center"
                    >
                      {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[color:var(--rsu-color-primary)] w-4 h-4 flex items-center justify-center"
                    >
                      {showConfirmPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {errorCode === 'PASSWORD_MISMATCH' ? (
                  <p className="text-xs text-red-600">Passwords don&apos;t match.</p>
                ) : (
                  errorCode && <ErrorMessage code={errorCode} />
                )}

                <button type="submit" disabled={loading} className="rsu-btn-primary w-full disabled:opacity-60">
                  {loading ? 'Resetting password...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Remembered your password?{' '}
          <Link href="/login" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

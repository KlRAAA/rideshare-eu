'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaCar, FaEnvelope, FaUser, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import Select from '@/components/Select';
import OtpInput from '@/components/OtpInput';
import { apiFetch, ApiError, setSessionCookie } from '@/lib/api';

type Step = 'EMAIL' | 'OTP' | 'PASSWORD';

const RESEND_COOLDOWN_SECONDS = 60;

function ErrorMessage({ code }: { code: string | undefined }) {
  const messages: Record<string, string> = {
    INVALID_DOMAIN: 'Email must end in @student.mseuf.edu.ph or @mseuf.edu.ph.',
    ACCOUNT_EXISTS: 'An account already exists for that email.',
    NO_PENDING_OTP: 'That code has expired. Send a new one.',
    OTP_EXPIRED: 'That code has expired. Send a new one.',
    INVALID_OTP: 'That code is incorrect. Check the 6 digits and try again.',
    TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Send a new code.',
    INVALID_OR_EXPIRED_TICKET: 'Your verification expired. Start again with your email.',
    EMPTY_FULL_NAME: 'Enter your full name.',
    FULL_NAME_TOO_SHORT: 'Full name must be at least 3 characters.',
    FULL_NAME_MATCHES_ID: "Full name can't be the same as your University ID.",
    TERMS_NOT_ACCEPTED: 'You must agree to the Terms of Use and Privacy Policy to continue.',
  };
  return <p className="text-xs text-red-600">{messages[code ?? ''] ?? 'Something went wrong reaching the server. Try again in a moment.'}</p>;
}

// Mirrors the server-side checks in authController.completeRegistration —
// kept in sync manually (small enough, and the messages differ from raw
// error codes) rather than sharing a validator across the Next/Express
// boundary.
function validateFullName(name: string, universityId: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return 'EMPTY_FULL_NAME';
  if (trimmed.length < 3) return 'FULL_NAME_TOO_SHORT';
  if (trimmed.toLowerCase() === universityId.trim().toLowerCase()) return 'FULL_NAME_MATCHES_ID';
  return undefined;
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationTicket, setVerificationTicket] = useState('');
  const [fullName, setFullName] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'UNSPECIFIED'>('UNSPECIFIED');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function emailPrefix(addr: string) {
    return addr.split('@')[0] || '';
  }

  async function requestOtp(addr: string) {
    setLoading(true);
    setErrorCode(undefined);
    try {
      await apiFetch('/api/auth/register/start', { method: 'POST', body: JSON.stringify({ email: addr }) });
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStep('OTP');
      setUniversityId(emailPrefix(addr));
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
      const { verificationTicket: ticket } = await apiFetch<{ verificationTicket: string }>('/api/auth/register/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });
      setVerificationTicket(ticket);
      setStep('PASSWORD');
    } catch (err) {
      setErrorCode(err instanceof ApiError ? err.code : undefined);
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fullNameError = validateFullName(fullName, universityId);
    if (fullNameError) {
      setErrorCode(fullNameError);
      return;
    }
    if (password !== confirmPassword) {
      setErrorCode('PASSWORD_MISMATCH');
      return;
    }
    if (!termsAccepted) {
      setErrorCode('TERMS_NOT_ACCEPTED');
      return;
    }
    setLoading(true);
    setErrorCode(undefined);
    try {
      const { token } = await apiFetch<{ token: string }>('/api/auth/register/complete', {
        method: 'POST',
        body: JSON.stringify({ verificationTicket, password, fullName, universityId, gender, termsAccepted }),
      });
      await setSessionCookie(token);
      router.push('/auth/dashboard');
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
              <h2 className="text-lg font-bold text-gray-900">Create Your Account</h2>
              <p className="text-sm text-gray-500 mt-1 mb-5">Enter your MSEUF school email to get started</p>
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
                {errorCode === 'ACCOUNT_EXISTS' && (
                  <p className="text-xs text-gray-600">
                    <Link href="/login" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
                      Log in instead
                    </Link>
                  </p>
                )}
                <button type="submit" disabled={loading} className="rsu-btn-primary w-full disabled:opacity-60">
                  {loading ? 'Sending code...' : 'Send Verification Code'}
                </button>
              </form>
            </>
          )}

          {step === 'OTP' && (
            <>
              <h2 className="text-lg font-bold text-gray-900">Verify Your Email</h2>
              <p className="text-sm text-gray-500 mt-1 mb-5">Enter the 6-digit code sent to {email}</p>
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
                <button
                  type="button"
                  onClick={() => setStep('EMAIL')}
                  className="text-gray-500 hover:underline"
                >
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
              <h2 className="text-lg font-bold text-gray-900">Set Up Your Account</h2>
              <p className="text-sm text-gray-500 mt-1 mb-5">Your email is verified — choose a password to finish</p>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    University ID
                  </label>
                  <input
                    type="text"
                    required
                    value={universityId}
                    onChange={(e) => setUniversityId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Gender</label>
                  <Select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'MALE' | 'FEMALE' | 'UNSPECIFIED')}
                    className="w-full pl-3 pr-9 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm"
                  >
                    <option value="UNSPECIFIED">Prefer not to say</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Used only for the optional same-gender co-rider matching preference.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Password
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
                    Confirm Password
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

                <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[color:var(--rsu-color-primary)]"
                  />
                  <span>
                    I agree to the{' '}
                    <Link href="/terms" target="_blank" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
                      Terms of Use
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" target="_blank" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>

                {errorCode === 'PASSWORD_MISMATCH' ? (
                  <p className="text-xs text-red-600">Passwords don&apos;t match.</p>
                ) : (
                  errorCode && <ErrorMessage code={errorCode} />
                )}

                <button type="submit" disabled={loading || !termsAccepted} className="rsu-btn-primary w-full disabled:opacity-60">
                  {loading ? 'Completing registration...' : 'Complete Registration'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

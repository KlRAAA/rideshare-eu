'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaCamera, FaCheckCircle, FaChevronRight, FaSpinner } from 'react-icons/fa';
import Select from '@/components/Select';
import Avatar from '@/components/Avatar';
import Tip from '@/components/Tip';
import ReportHistoryModal from '@/components/ReportHistoryModal';
import DeleteAccountPanel from './DeleteAccountPanel';
import MyCarsCard from './MyCarsCard';
import { useMode } from '@/components/ModeProvider';
import { apiFetch, clearSessionCookie, API_BASE } from '@/lib/api';
import type { CurrentUser } from '@/lib/session';
import { isWomenPlusEligible, TRIPS_I_SEE_OPTIONS, type GenderPreference } from '@/lib/riderRules';
import GenderCard from './GenderCard';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_ERROR_COPY: Record<string, string> = {
  UNSUPPORTED_IMAGE_TYPE: 'That file isn’t a JPEG, PNG, or WebP image.',
  FILE_TOO_LARGE: 'Image must be 5 MB or smaller.',
  NO_FILE: 'No file selected.',
};

export interface Preference {
  genderPreference: GenderPreference;
  flexWindowMinutes: number;
  familiarRidersOnly: boolean;
}

const FLEX_OPTIONS = [5, 15, 30, 60];

// One bordered list per section, rows divided by a line (no card per setting).
const ROWS = 'divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white';
const ROW = 'px-4 py-3';
const LINK_ROW = 'flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50';
const SELECT = 'rounded-xl border border-gray-300 bg-gray-50 py-2 pl-3 pr-9 text-sm disabled:text-gray-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

interface ProfileClientProps {
  user: CurrentUser;
  initialPreference: Preference;
  // Server-rendered parts, placed by section: license status and the push card.
  license: React.ReactNode;
  notifications: React.ReactNode;
}

// Profile, grouped by what people come here to do. Passenger mode shows ride
// preferences; Driver mode shows the license, cars and driving summary.
export default function ProfileClient({ user, initialPreference, license, notifications }: ProfileClientProps) {
  const router = useRouter();
  const mode = useMode();
  const isDriver = mode === 'DRIVER';
  const [preference, setPreference] = useState(initialPreference);
  const [prefStatus, setPrefStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const womenPlusEligible = isWomenPlusEligible(user.gender);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showReportHistory, setShowReportHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after a failure
    if (!file) return;

    setAvatarError(null);
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError(AVATAR_ERROR_COPY.UNSUPPORTED_IMAGE_TYPE);
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(AVATAR_ERROR_COPY.FILE_TOO_LARGE);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await fetch(`${API_BASE}/api/users/me/avatar`, { method: 'POST', body: form, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvatarError(AVATAR_ERROR_COPY[data.error] ?? 'Couldn’t upload that image. Try again.');
        setAvatarPreview(null);
        URL.revokeObjectURL(previewUrl);
        return;
      }
      setAvatarUrl(data.user.avatarUrl); // preview stays visible until navigation
      router.refresh();
    } catch {
      setAvatarError('Couldn’t upload that image. Try again.');
      setAvatarPreview(null);
      URL.revokeObjectURL(previewUrl);
    } finally {
      setAvatarUploading(false);
    }
  }

  // Each preference saves as soon as it changes; a failure puts it back.
  async function savePreference(change: Partial<Preference>) {
    const before = preference;
    const next = { ...preference, ...change };
    setPreference(next);
    setPrefStatus('saving');
    try {
      await apiFetch(`/api/preferences/${user.id}`, { method: 'PATCH', body: JSON.stringify(next) });
      setPrefStatus('saved');
    } catch {
      setPreference(before);
      setPrefStatus('error');
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await clearSessionCookie();
    router.push('/login');
  }

  const photo = avatarPreview ?? avatarUrl;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex items-center gap-4">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarSelect} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
          aria-label={photo ? 'Change profile photo' : 'Add a profile photo'}
          className="relative h-16 w-16 shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rsu-color-primary)]"
        >
          <Avatar name={user.fullName} src={photo} sizeClass="w-16 h-16" textClass="text-xl" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[color:var(--rsu-color-primary)] text-white">
            {avatarUploading ? <FaSpinner className="h-3 w-3 animate-spin" aria-hidden /> : <FaCamera className="h-3 w-3" aria-hidden />}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xl font-bold text-gray-900">
            <span className="truncate">{user.fullName}</span>
            {user.verified && (
              <Tip label="Verified university member" iconOnly>
                <FaCheckCircle className="h-4 w-4 text-[color:var(--rsu-color-primary)]" aria-hidden />
              </Tip>
            )}
          </p>
          <p className="text-sm text-gray-600">
            ★ {user.trustScore.toFixed(1)} · {isDriver ? `${user.tripsHosted} trips driven` : `${user.tripsJoined} rides`}
          </p>
          <p className="truncate text-xs text-gray-500">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="shrink-0 self-start rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
      </header>
      {avatarError && (
        <p role="alert" className="-mt-4 text-sm text-red-600">
          {avatarError}
        </p>
      )}

      {!isDriver && (
        <Section title="Ride preferences">
          <div className={ROWS}>
            <div className={`${ROW} flex items-center justify-between gap-3`}>
              <label htmlFor="pref-trips" className="text-sm text-gray-800">
                Trips I see
              </label>
              <Select
                id="pref-trips"
                disabled={!womenPlusEligible}
                value={preference.genderPreference}
                onChange={(e) => savePreference({ genderPreference: e.target.value as GenderPreference })}
                className={SELECT}
              >
                {TRIPS_I_SEE_OPTIONS.filter((o) => womenPlusEligible || o.value === 'ANY').map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className={`${ROW} flex items-center justify-between gap-3`}>
              <label htmlFor="pref-flex" className="text-sm text-gray-800">
                Time flexibility
              </label>
              <Select
                id="pref-flex"
                value={preference.flexWindowMinutes}
                onChange={(e) => savePreference({ flexWindowMinutes: Number(e.target.value) })}
                className={SELECT}
              >
                {FLEX_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    ±{n} min
                  </option>
                ))}
              </Select>
            </div>
            <label className={`${ROW} flex items-center justify-between gap-3`}>
              <span className="text-sm text-gray-800">Only riders I’ve ridden with</span>
              <input
                type="checkbox"
                checked={preference.familiarRidersOnly}
                onChange={(e) => savePreference({ familiarRidersOnly: e.target.checked })}
                className="h-5 w-5 accent-[color:var(--rsu-color-primary)]"
              />
            </label>
          </div>
          <p className="px-1 text-xs text-gray-500" aria-live="polite">
            {prefStatus === 'saving'
              ? 'Saving…'
              : prefStatus === 'saved'
                ? 'Saved. Find a Ride starts from these.'
                : prefStatus === 'error'
                  ? 'Couldn’t save that. Try again.'
                  : womenPlusEligible
                    ? 'Find a Ride starts from these.'
                    : 'Women+ trips are for women and non-binary riders.'}
          </p>
        </Section>
      )}

      {isDriver && (
        <Section title="Driving">
          {license}
          <MyCarsCard />
          <div className={ROWS}>
            <Link href="/auth/driver" className={LINK_ROW}>
              My driving: rides and fuel share
              <FaChevronRight className="h-3 w-3 text-gray-400" aria-hidden />
            </Link>
          </div>
        </Section>
      )}

      <Section title="Notifications">{notifications}</Section>

      <Section title="Account">
        <div className={ROWS}>
          <div className={`${ROW} flex items-center justify-between gap-3 text-sm`}>
            <span className="text-gray-600">Name</span>
            <span className="truncate font-medium text-gray-900">{user.fullName}</span>
          </div>
          <div className={`${ROW} flex items-center justify-between gap-3 text-sm`}>
            <span className="text-gray-600">University ID</span>
            <span className="font-medium tabular-nums text-gray-900">{user.universityId}</span>
          </div>
          <div className={ROW}>
            <GenderCard initialGender={user.gender ?? 'PREFER_NOT_TO_SAY'} />
          </div>
          {/* Replays the tour via the dashboard's ?tour=1 check; hasSeenOnboarding is left as is. */}
          <button type="button" onClick={() => router.push('/auth/dashboard?tour=1')} className={`${LINK_ROW} w-full text-left`}>
            Show the tour again
            <FaChevronRight className="h-3 w-3 text-gray-400" aria-hidden />
          </button>
          {user.isAdmin && (
            <Link href="/auth/admin" className={LINK_ROW}>
              Admin console
              <FaChevronRight className="h-3 w-3 text-gray-400" aria-hidden />
            </Link>
          )}
        </div>
        <p className="px-1 text-xs text-gray-500">Your name and ID come from the school. Ask an admin to correct them.</p>
      </Section>

      <Section title="Help and safety">
        <div className={ROWS}>
          <Link href="/help" className={LINK_ROW}>
            Help, emergency numbers and admins
            <FaChevronRight className="h-3 w-3 text-gray-400" aria-hidden />
          </Link>
          <button type="button" onClick={() => setShowReportHistory(true)} className={`${LINK_ROW} w-full text-left`}>
            Reports you’ve made
            <FaChevronRight className="h-3 w-3 text-gray-400" aria-hidden />
          </button>
          <div className={`${ROW} flex gap-4 text-sm`}>
            <Link href="/privacy" className="font-medium text-gray-700 hover:underline">
              Privacy policy
            </Link>
            <Link href="/terms" className="font-medium text-gray-700 hover:underline">
              Terms of use
            </Link>
          </div>
          <div className="px-4">
            <DeleteAccountPanel />
          </div>
        </div>
      </Section>

      {showReportHistory && <ReportHistoryModal onClose={() => setShowReportHistory(false)} />}
    </div>
  );
}

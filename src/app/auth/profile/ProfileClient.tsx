'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaFlag, FaSignOutAlt, FaSpinner, FaCompass } from 'react-icons/fa';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import Select from '@/components/Select';
import Avatar from '@/components/Avatar';
import ReportHistoryModal from '@/components/ReportHistoryModal';
import { apiFetch, clearSessionCookie, API_BASE } from '@/lib/api';
import { roleLabel } from '@/lib/format';
import type { CurrentUser } from '@/lib/session';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_ERROR_COPY: Record<string, string> = {
  UNSUPPORTED_IMAGE_TYPE: 'That file isn’t a JPEG, PNG, or WebP image.',
  FILE_TOO_LARGE: 'Image must be 5 MB or smaller.',
  NO_FILE: 'No file selected.',
};

export interface Preference {
  genderPreference: 'ANY' | 'SAME_GENDER';
  flexWindowMinutes: number;
  familiarRidersOnly: boolean;
  liveLocationSharing: boolean;
}

const FLEX_OPTIONS = [5, 15, 30, 60];

export default function ProfileClient({ user, initialPreference }: { user: CurrentUser; initialPreference: Preference }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [preference, setPreference] = useState(initialPreference);
  const [saving, setSaving] = useState(false);
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
      form.append('userId', user.id);
      form.append('avatar', file);
      const res = await fetch(`${API_BASE}/api/users/me/avatar`, { method: 'POST', body: form });
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

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch(`/api/preferences/${user.id}`, { method: 'PATCH', body: JSON.stringify(preference) });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await clearSessionCookie();
    router.push('/login');
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Card className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-3">
            <Avatar
              name={user.fullName}
              src={avatarPreview ?? avatarUrl}
              sizeClass="w-16 h-16"
              textClass="text-xl"
            />
            {avatarUploading && (
              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center">
                <FaSpinner className="w-4 h-4 text-white animate-spin" />
              </div>
            )}
          </div>
          <h2 className="text-lg font-bold text-gray-900">{user.fullName}</h2>
          <div className="flex justify-center mt-1">
            <Badge tone="neutral">{roleLabel(user.role)}</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-2">{user.email}</p>
          <p className="text-sm font-semibold text-gray-800 mt-3">
            ★ {user.trustScore.toFixed(1)} <span className="text-gray-400 font-normal">/5.0</span>
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="rsu-btn-secondary w-full mt-4 disabled:opacity-60"
          >
            {avatarUploading ? 'Uploading…' : avatarUrl ? 'Change Profile Photo' : 'Add Profile Photo'}
          </button>
          {avatarError && <p className="text-xs text-red-600 mt-2">{avatarError}</p>}
          <p className="text-[11px] text-gray-400 mt-1">JPEG, PNG or WebP · up to 5 MB</p>
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-gray-900 mb-3">Activity Summary</h3>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Trips Hosted</span>
            <span className="font-semibold text-gray-900">{user.tripsHosted}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-500">Trips Joined</span>
            <span className="font-semibold text-gray-900">{user.tripsJoined}</span>
          </div>
          {user.verified && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <Badge tone="success">Verified University Member</Badge>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-gray-900">Matching Preferences</h3>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-[color:var(--rsu-color-primary)]">
                Edit
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-4">Set your default preferences for finding and posting rides</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Co-rider Gender Preference
              </label>
              <Select
                disabled={!editing}
                value={preference.genderPreference}
                onChange={(e) => setPreference((p) => ({ ...p, genderPreference: e.target.value as Preference['genderPreference'] }))}
                className="w-full pl-3 pr-9 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm disabled:text-gray-500"
              >
                <option value="ANY">Any</option>
                <option value="SAME_GENDER">Same-gender only</option>
              </Select>
              <p className="text-[11px] text-gray-400 mt-1">This will be your default when posting or searching for rides</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Departure Time Flexibility
              </label>
              <Select
                disabled={!editing}
                value={preference.flexWindowMinutes}
                onChange={(e) => setPreference((p) => ({ ...p, flexWindowMinutes: Number(e.target.value) }))}
                className="w-full pl-3 pr-9 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm disabled:text-gray-500"
              >
                {FLEX_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    ±{n} minutes
                  </option>
                ))}
              </Select>
              <p className="text-[11px] text-gray-400 mt-1">How flexible you are with departure times</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Familiar Riders Only</p>
                <p className="text-xs text-gray-500">Only match with people you've ridden with before</p>
              </div>
              <input
                type="checkbox"
                disabled={!editing}
                checked={preference.familiarRidersOnly}
                onChange={(e) => setPreference((p) => ({ ...p, familiarRidersOnly: e.target.checked }))}
                className="w-5 h-5 accent-[color:var(--rsu-color-primary)]"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Live Location Sharing</p>
                <p className="text-xs text-gray-500">Optional — lets a trip near campus auto-mark as completed</p>
              </div>
              <input
                type="checkbox"
                disabled={!editing}
                checked={preference.liveLocationSharing}
                onChange={(e) => setPreference((p) => ({ ...p, liveLocationSharing: e.target.checked }))}
                className="w-5 h-5 accent-[color:var(--rsu-color-primary)]"
              />
            </div>
          </div>

          {editing && (
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={handleSave} disabled={saving} className="rsu-btn-primary flex-1 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreference(initialPreference);
                  setEditing(false);
                }}
                className="rsu-btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-gray-900 mb-1">Account Settings</h3>
          <p className="text-xs text-gray-500 mb-4">Manage your account information</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Display Name</label>
              <input
                type="text"
                readOnly
                value={user.fullName}
                className="w-full px-3 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-sm text-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">University ID</label>
              <input
                type="text"
                readOnly
                value={user.universityId}
                className="w-full px-3 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-sm text-gray-600"
              />
              <p className="text-[11px] text-gray-400 mt-1">Contact admin to update verified credentials</p>
            </div>
            <button
              type="button"
              // Re-runs the tour client-side via OnboardingTour's ?tour=1
              // check on the dashboard — the DB's hasSeenOnboarding flag is
              // left untouched, so this is a manual replay, not a reset of
              // "don't auto-show again."
              onClick={() => router.push('/auth/dashboard?tour=1')}
              className="flex items-center gap-2 text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
            >
              <FaCompass className="w-4 h-4" />
              Show tutorial again
            </button>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-gray-900 mb-1">Privacy &amp; Safety</h3>
          <button
            type="button"
            onClick={() => setShowReportHistory(true)}
            className="flex items-center gap-2 text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline mt-2"
          >
            <FaFlag className="w-3.5 h-3.5" />
            View Report History
          </button>
          <p className="text-[11px] text-gray-400 mt-1">See reports you've submitted (privacy protected)</p>
        </Card>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center justify-center gap-2 w-full py-3 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
        >
          <FaSignOutAlt className="w-4 h-4" />
          {loggingOut ? 'Logging out...' : 'Log Out'}
        </button>
      </div>

      {showReportHistory && <ReportHistoryModal onClose={() => setShowReportHistory(false)} />}
    </div>
  );
}

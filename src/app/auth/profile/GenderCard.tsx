'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import Select from '@/components/Select';
import { apiFetch, ApiError } from '@/lib/api';
import { GENDER_HELP, GENDER_OPTIONS, genderChangeMessage, type Gender } from '@/lib/riderRules';

// Your own self-declared gender (Women+ spec D2). Leaving Women+ eligibility
// can withdraw pending Women+ requests (D8, asked first) or be blocked while
// you host open Women+ trips (D7).
export default function GenderCard({ initialGender }: { initialGender: Gender }) {
  const router = useRouter();
  const [gender, setGender] = useState<Gender>(initialGender);
  const [saving, setSaving] = useState(false);
  const [confirmText, setConfirmText] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);

  async function save(confirm: boolean) {
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch('/api/users/me/gender', { method: 'PATCH', body: JSON.stringify({ gender, confirm }) });
      setConfirmText(null);
      setMessage({ tone: 'ok', text: 'Saved.' });
      router.refresh();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      const text = code ? genderChangeMessage(code, (err as ApiError).body ?? {}) : null;
      if (code === 'CONFIRM_WITHDRAW_PENDING' && text) setConfirmText(text);
      else setMessage({ tone: 'error', text: text ?? 'Couldn’t save your gender. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  const changed = gender !== initialGender;

  return (
    <Card>
      <label htmlFor="profile-gender" className="block text-sm font-bold text-gray-900 mb-1">
        Gender
      </label>
      <p className="text-xs text-gray-500 mb-3">{GENDER_HELP}</p>
      <Select
        id="profile-gender"
        value={gender}
        onChange={(e) => {
          setGender(e.target.value as Gender);
          setConfirmText(null);
          setMessage(null);
        }}
        className="w-full pl-3 pr-9 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm"
      >
        {GENDER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      {confirmText ? (
        <div role="alertdialog" aria-label="Confirm gender change" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">{confirmText}</p>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => setConfirmText(null)} className="rsu-btn-secondary flex-1">
              Cancel
            </button>
            <button type="button" onClick={() => save(true)} disabled={saving} className="rsu-btn-primary flex-1 disabled:opacity-60">
              Change and withdraw
            </button>
          </div>
        </div>
      ) : (
        changed && (
          <button type="button" onClick={() => save(false)} disabled={saving} className="rsu-btn-primary w-full mt-3 disabled:opacity-60">
            {saving ? 'Saving...' : 'Save gender'}
          </button>
        )
      )}
      {message && (
        <p className={`text-xs mt-2 ${message.tone === 'error' ? 'text-red-600' : 'text-green-700'}`}>{message.text}</p>
      )}
    </Card>
  );
}

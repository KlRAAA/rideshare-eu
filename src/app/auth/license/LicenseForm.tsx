'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaUpload, FaLock } from 'react-icons/fa';
import Card from '@/components/Card';
import Select from '@/components/Select';
import { API_BASE } from '@/lib/api';
import { LICENSE_TYPE_OPTIONS, licenseErrorMessage, type LicenseType } from '@/lib/license';

const inputClass = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]';
const labelClass = 'block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1';

export default function LicenseForm({ renewal }: { renewal: boolean }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseType, setLicenseType] = useState<LicenseType>('NON_PROFESSIONAL');
  const [expiresOn, setExpiresOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) {
      setError(licenseErrorMessage('INVALID_IMAGE'));
      return;
    }
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append('photo', photo);
    form.append('licenseNumber', licenseNumber);
    form.append('licenseType', licenseType);
    form.append('expiresOn', expiresOn);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/license`, { method: 'POST', body: form, credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(licenseErrorMessage(body.error, body.field));
        return;
      }
      router.refresh();
    } catch {
      setError('Couldn’t reach the server. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-sm font-bold text-gray-900">{renewal ? 'Upload a renewed license' : 'Upload your license'}</h2>
        <div>
          <label htmlFor="license-photo" className={labelClass}>
            Photo of the front
          </label>
          <input
            id="license-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
          />
          <p className="text-xs text-gray-500 mt-1">Make sure your name, the number and the expiry date are easy to read. Up to 5 MB.</p>
        </div>
        <div>
          <label htmlFor="license-number" className={labelClass}>
            License number
          </label>
          <input
            id="license-number"
            required
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            placeholder="N01-23-456789"
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="license-type" className={labelClass}>
              Type
            </label>
            <Select id="license-type" value={licenseType} onChange={(e) => setLicenseType(e.target.value as LicenseType)} className="w-full pl-3 pr-9 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm">
              {LICENSE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="license-expiry" className={labelClass}>
              Expiry date
            </label>
            <input id="license-expiry" type="date" required value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputClass} />
          </div>
        </div>
        {licenseType === 'STUDENT_PERMIT' && (
          <p className="text-xs text-amber-800">A student permit doesn’t allow carrying passengers, so it can’t be approved for posting trips.</p>
        )}
        <p className="flex items-start gap-2 text-xs text-gray-500">
          <FaLock className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
          Only admins see the photo, and it’s deleted once they decide. We keep the expiry date and the last 4 characters of the number.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="rsu-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          <FaUpload className="w-3.5 h-3.5" aria-hidden />
          {busy ? 'Uploading…' : 'Send for review'}
        </button>
      </form>
    </Card>
  );
}

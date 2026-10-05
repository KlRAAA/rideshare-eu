'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Card from '@/components/Card';
import Select from '@/components/Select';
import ReleaseView from '@/components/ReleaseView';
import { apiFetch, ApiError } from '@/lib/api';
import {
  allowsContent,
  AUDIT_NOTE,
  BASIS_OPTIONS,
  dataRequestFormError,
  type DataRequestFormValues,
  type Release,
} from '@/lib/dataRequests';
import PrintButton from '../PrintButton';

interface FoundUser {
  id: string;
  fullName: string;
  email: string;
  universityId: string;
}

const EMPTY: DataRequestFormValues = {
  subjectUserId: '',
  agency: '',
  officerName: '',
  officerContact: '',
  referenceNumber: '',
  legalBasis: 'WARRANT',
  fromDate: '',
  toDate: '',
  includeChats: false,
  includeSupport: false,
  verificationNote: '',
  password: '',
};

const ERROR_COPY: Record<string, string> = {
  INVALID_PASSWORD: 'That password isn’t right.',
  PASSWORD_REQUIRED: 'Enter your password to release records.',
  TOO_MANY_REQUESTS: 'Too many attempts. Try again in a few minutes.',
  CANNOT_TARGET_SELF: 'You can’t release your own records.',
  USER_NOT_FOUND: 'That person no longer exists.',
};

const INPUT =
  'w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]';
const LABEL = 'block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1';

function TextField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={200} className={INPUT} />
    </div>
  );
}

export default function DataRequestForm() {
  const [values, setValues] = useState<DataRequestFormValues>(EMPTY);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundUser[]>([]);
  const [chosen, setChosen] = useState<FoundUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [release, setRelease] = useState<Release | null>(null);

  const set = <K extends keyof DataRequestFormValues>(key: K, value: DataRequestFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const emergency = values.legalBasis === 'EMERGENCY';
  const contentAllowed = allowsContent(values.legalBasis);

  async function search() {
    if (!query.trim()) return;
    const { users } = await apiFetch<{ users: FoundUser[] }>(`/api/admin/users?q=${encodeURIComponent(query.trim())}`);
    setResults(users);
  }

  function choose(u: FoundUser) {
    setChosen(u);
    set('subjectUserId', u.id);
    setResults([]);
  }

  function changeBasis(basis: string) {
    setValues((v) => ({
      ...v,
      legalBasis: basis,
      includeChats: allowsContent(basis) && v.includeChats,
      includeSupport: allowsContent(basis) && v.includeSupport,
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = dataRequestFormError(values);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const body = emergency ? { ...values, fromDate: undefined, toDate: undefined } : values;
      const result = await apiFetch<{ release: Release }>('/api/admin/data-requests', { method: 'POST', body: JSON.stringify(body) });
      setRelease(result.release);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      const field = err instanceof ApiError ? err.body?.field : undefined;
      setError(
        (code && ERROR_COPY[code]) ||
          (code === 'INVALID_DATA_REQUEST' ? `Check the ${String(field)} field.` : 'Couldn’t release the records. Try again.')
      );
      set('password', '');
    } finally {
      setBusy(false);
    }
  }

  if (release) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 no-print">
          <Link href="/auth/admin/data-requests" className="text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
            Back to data requests
          </Link>
          <PrintButton />
        </div>
        <ReleaseView release={release} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <p className={LABEL}>Person</p>
        {chosen ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-gray-900">
              {chosen.fullName} <span className="text-gray-500">· {chosen.universityId}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setChosen(null);
                set('subjectUserId', '');
              }}
              className="text-xs font-semibold text-[color:var(--rsu-color-primary)]"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <label htmlFor="dr-person-search" className="sr-only">
                Search for the person
              </label>
              <input
                id="dr-person-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    search();
                  }
                }}
                placeholder="Name, email or university ID"
                className={INPUT}
              />
              <button type="button" onClick={search} className="rsu-btn-secondary shrink-0">
                Search
              </button>
            </div>
            {results.length > 0 && (
              <ul className="mt-2 divide-y divide-gray-100 border border-gray-200 rounded-xl">
                {results.map((u) => (
                  <li key={u.id}>
                    <button type="button" onClick={() => choose(u)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                      {u.fullName} <span className="text-gray-500">· {u.universityId}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField id="dr-agency" label="Requesting agency" value={values.agency} onChange={(v) => set('agency', v)} />
          <TextField id="dr-officer" label="Officer (rank, name, unit)" value={values.officerName} onChange={(v) => set('officerName', v)} />
          <TextField id="dr-contact" label="Officer contact" value={values.officerContact} onChange={(v) => set('officerContact', v)} />
          <TextField
            id="dr-reference"
            label="Case, blotter or docket number"
            value={values.referenceNumber}
            onChange={(v) => set('referenceNumber', v)}
          />
        </div>
      </Card>

      <Card>
        <label htmlFor="dr-basis" className={LABEL}>
          Legal basis
        </label>
        <Select id="dr-basis" value={values.legalBasis} onChange={(e) => changeBasis(e.target.value)} className={`${INPUT} pr-9`}>
          {BASIS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {emergency ? (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
            An emergency release shows only the most recent trip, any trip in the next 24 hours and the person’s regular trips.
            The written request is due within 72 hours.
          </p>
        ) : (
          <div className="grid gap-3 grid-cols-2 mt-3">
            <div>
              <label htmlFor="dr-from" className={LABEL}>
                From
              </label>
              <input id="dr-from" type="date" value={values.fromDate} onChange={(e) => set('fromDate', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="dr-to" className={LABEL}>
                To
              </label>
              <input id="dr-to" type="date" value={values.toDate} onChange={(e) => set('toDate', e.target.value)} className={INPUT} />
            </div>
          </div>
        )}
        <div className="space-y-2 mt-3">
          {(
            [
              ['includeChats', 'dr-chats', 'The document names trip chat messages'],
              ['includeSupport', 'dr-support', 'The document names support requests'],
            ] as const
          ).map(([key, id, label]) => (
            <label key={id} htmlFor={id} className={`flex items-center gap-2 text-sm ${contentAllowed ? 'text-gray-800' : 'text-gray-400'}`}>
              <input
                id={id}
                type="checkbox"
                disabled={!contentAllowed}
                checked={values[key]}
                onChange={(e) => set(key, e.target.checked)}
                className="w-4 h-4 accent-[color:var(--rsu-color-primary)]"
              />
              {label}
            </label>
          ))}
          {!contentAllowed && <p className="text-xs text-gray-500">Only a warrant or court order can cover chats and support requests.</p>}
        </div>
      </Card>

      <Card>
        <label htmlFor="dr-verification" className={LABEL}>
          How did you verify this request?
        </label>
        <textarea
          id="dr-verification"
          value={values.verificationNote}
          onChange={(e) => set('verificationNote', e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="For example: called the station on its listed number and confirmed the officer and case."
          className={INPUT}
        />
        <label htmlFor="dr-password" className={`${LABEL} mt-3`}>
          Your password
        </label>
        <input
          id="dr-password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => set('password', e.target.value)}
          className={INPUT}
        />
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">{AUDIT_NOTE}</p>
      <button type="submit" disabled={busy} className="rsu-btn-primary w-full disabled:opacity-60">
        {busy ? 'Releasing...' : 'Release records'}
      </button>
    </form>
  );
}

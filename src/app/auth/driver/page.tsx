import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BackButton from '@/components/BackButton';
import Card from '@/components/Card';
import { apiFetch } from '@/lib/api-server';
import { barHeights, peso, weekLabel, type DriverSummary } from '@/lib/driverSummary';

const PERIODS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
] as const;

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' });

// "My driving" (sub-project H): rides, riders carried and fuel share from riders.
export default async function DriverSummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const asked = (await searchParams).period;
  const period = PERIODS.some((p) => p.value === asked) ? (asked as DriverSummary['period']) : 'month';
  const summary = await apiFetch<DriverSummary>(`/api/driver/summary?period=${period}`);
  const heights = barHeights(summary.weeks);
  const tiles = [
    { label: 'Rides', value: String(summary.totals.rides) },
    { label: 'Riders carried', value: String(summary.totals.riders) },
    { label: 'Fuel share from riders', value: peso(summary.totals.fuelShare) },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="dashboard" />
      <main className="app-desktop w-full pt-2 md:pt-4 space-y-4">
        <BackButton fallback="/auth/dashboard" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My driving</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your rides, the riders you carried and their fuel share</p>
        </div>

        <nav aria-label="Period" className="flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/auth/driver?period=${p.value}`}
              aria-current={p.value === period ? 'page' : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                p.value === period ? 'bg-[color:var(--rsu-color-primary)] text-white' : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {p.label}
            </Link>
          ))}
        </nav>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rsu-card text-center">
              <p className="text-xl sm:text-2xl font-extrabold text-gray-900 tabular-nums">{t.value}</p>
              <p className="text-xs text-gray-500 mt-1">{t.label}</p>
            </div>
          ))}
        </div>

        <Card className="space-y-3">
          <h2 className="text-sm font-bold text-gray-900">Rides per week</h2>
          <div className="flex h-32 items-end gap-1" role="img" aria-label="Rides in each of the last 12 weeks">
            {summary.weeks.map((w, i) => (
              <div key={w.weekStart} className="flex h-full flex-1 flex-col justify-end" title={`${weekLabel(w.weekStart)}: ${w.rides} rides, ${peso(w.fuelShare)}`}>
                <div className="rounded-t bg-[color:var(--rsu-color-primary)]" style={{ height: `${Math.max(heights[i], w.rides ? 4 : 0)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 tabular-nums">
            <span>{weekLabel(summary.weeks[0].weekStart)}</span>
            <span>This week</span>
          </div>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-sm font-bold text-gray-900">Recent rides</h2>
          {summary.recent.length === 0 ? (
            <p className="text-sm text-gray-500">No completed rides yet. They show here after you end a trip.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {summary.recent.map((r) => (
                <li key={`${r.tripId}-${r.date}`}>
                  <Link href={`/auth/trips/${r.tripId}`} className="flex items-center justify-between gap-3 py-2 hover:bg-gray-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900">{r.destination}</span>
                      <span className="block text-xs text-gray-500">
                        {dateLabel(r.date)} · {r.riders} {r.riders === 1 ? 'rider' : 'riders'}
                        {r.estimated && ' (estimate)'}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{peso(r.fuelShare)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="text-xs text-gray-500">
          Riders pay the fuel share in person. These are the amounts the app showed them, not payments received. Days marked
          “estimate” are from before the app saved who rode each day.
        </p>
      </main>
      <BottomNav active="dashboard" />
    </div>
  );
}

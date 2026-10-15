import React, { Suspense } from 'react';
import PushCard from '@/components/PushCard';
import ModeSegmented from '@/components/ModeSegmented';
import { summaryLine, type DriverSummary } from '@/lib/driverSummary';
import Link from 'next/link';
import { FaChevronRight } from 'react-icons/fa';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Badge from '@/components/Badge';
import OnboardingTour from '@/components/OnboardingTour';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import WarningBanner from '@/components/WarningBanner';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import { formatTime, formatDateTimeAgo } from '@/lib/format';
import { shortPlace } from '@/lib/places';
import { seatsLeft, tripRoute, tripWhen } from '@/lib/tripLine';
import { dayLabel, type TripDay } from '@/lib/tripDays';
import TripRow, { TRIP_LIST } from '@/components/TripRow';
import ConfirmDayButton from '@/components/ConfirmDayButton';

interface Vehicle {
  make: string;
  model: string;
  color: string;
}

interface Trip {
  id: string;
  matches?: { status: string }[];
  originAddress: string;
  destinationAddress: string;
  departureTime: string;
  recurrenceType: string;
  totalSeats: number;
  filledSeats: number;
  vehicle: Vehicle;
  status: string;
  matchStatus?: string;
  inProgress?: boolean;
}

interface Notification {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

type Upcoming = Trip & { role: 'Host' | 'Passenger' };

const SECTION_TITLE = 'text-base font-semibold text-gray-900';

function tripStatus(trip: Upcoming): { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' } | null {
  if (trip.inProgress) return { label: 'In progress', tone: 'info' };
  if (trip.role === 'Passenger') {
    return trip.matchStatus === 'APPROVED' ? { label: 'Confirmed', tone: 'success' } : { label: 'Waiting for driver', tone: 'warning' };
  }
  return trip.status === 'FULL' ? { label: 'Full', tone: 'neutral' } : null;
}

// The first upcoming trip, set like a timetable entry: the time first. For a
// driver it names the next trip day and, while riders wait to hear, offers Confirm.
function NextRide({ trip, day }: { trip: Upcoming; day: TripDay | null }) {
  const askConfirm = day !== null && day.status === null && hasRiders(trip);
  const status = day && !trip.inProgress ? dayStatus(day, askConfirm) : tripStatus(trip);
  return (
    <div className="rsu-card flex flex-col gap-3">
      <Link href={`/auth/trips/${trip.id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <p className="text-3xl font-bold tabular-nums text-gray-900" suppressHydrationWarning>
            {formatTime(day?.departure ?? trip.departureTime)}
          </p>
          {status && <Badge tone={status.tone}>{status.label}</Badge>}
        </div>
        <p className="mt-0.5 text-sm text-gray-500" suppressHydrationWarning>
          {day && trip.recurrenceType !== 'ONE_TIME' ? `${dayLabel(day.date)} · ${tripWhen(trip)}` : tripWhen(trip)}
        </p>
        <p className="mt-3 font-semibold text-gray-900">{tripRoute(trip)}</p>
        <p className="mt-0.5 text-sm text-gray-500">
          {trip.vehicle.make} {trip.vehicle.model} · {seatsLeft(trip)}
        </p>
      </Link>
      {askConfirm && <ConfirmDayButton tripId={trip.id} date={day.date} />}
    </div>
  );
}

const hasRiders = (trip: Trip) => (trip.matches ?? []).some((m) => m.status === 'APPROVED' || m.status === 'PENDING');

function dayStatus(day: TripDay, askConfirm: boolean): { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' } | null {
  if (day.status === 'CONFIRMED') return { label: 'Confirmed', tone: 'success' };
  if (day.status === 'SKIPPED') return { label: 'Skipped', tone: 'neutral' };
  return askConfirm ? { label: 'Not confirmed', tone: 'warning' } : null;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Each mode's home shows only its own trips and action (sub-project C).
  const isDriver = user?.activeMode === 'DRIVER';
  let upcoming: Upcoming[] = [];
  let alerts: Notification[] = [];
  let unreadCount = 0;
  let waiting: { count: number; tripId: string | null } = { count: 0, tripId: null };
  let month: DriverSummary['totals'] | null = null;
  let nextDay: TripDay | null = null;

  if (user) {
    const [{ hosted, joined }, { notifications }] = await Promise.all([
      apiFetch<{ hosted: Trip[]; joined: Trip[] }>(`/api/trips/mine?userId=${user.id}`),
      apiFetch<{ notifications: Notification[] }>(`/api/alerts?mode=${isDriver ? 'driver' : 'passenger'}`),
    ]);
    const activeHosted = hosted.filter((t) => t.status === 'OPEN' || t.status === 'FULL');
    upcoming = (
      isDriver
        ? activeHosted.map((t) => ({ ...t, role: 'Host' as const }))
        : joined
            .filter((t) => t.matchStatus === 'PENDING' || t.matchStatus === 'APPROVED')
            .map((t) => ({ ...t, role: 'Passenger' as const }))
    ).sort((a, b) => Number(b.inProgress ?? false) - Number(a.inProgress ?? false));
    const withRequests = activeHosted.filter((t) => t.matches?.some((m) => m.status === 'PENDING'));
    waiting = {
      count: withRequests.reduce((n, t) => n + (t.matches?.filter((m) => m.status === 'PENDING').length ?? 0), 0),
      tripId: withRequests[0]?.id ?? null,
    };
    unreadCount = notifications.filter((n) => !n.isRead).length;
    // Sub-project H: this month's driving, in Driver mode.
    if (isDriver) month = (await apiFetch<DriverSummary>('/api/driver/summary?period=month')).totals;
    alerts = notifications.slice(0, 3);
    // The driver's next trip day (confirmed or not) lives on the trip itself.
    const first = upcoming[0];
    if (isDriver && first && !first.inProgress) {
      const { trip } = await apiFetch<{ trip: { days?: TripDay[] } }>(`/api/trips/${first.id}`);
      nextDay = trip.days?.[0] ?? null;
    }
  }

  const [next, ...later] = upcoming;
  const firstName = user?.fullName.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between pb-24">
      {user && (
        <Suspense fallback={null}>
          <OnboardingTour hasSeenOnboarding={user.hasSeenOnboarding} />
        </Suspense>
      )}
      <Header active="dashboard" unreadCount={unreadCount} />

      <main className="app-desktop w-full p-0 pt-2 md:pt-4 space-y-6 flex-grow">
        <WarningBanner />
        <AnnouncementBanner />
        <PushCard placement="dashboard" />

        <section className="flex flex-col gap-4">
          <h1 className="font-extrabold text-gray-900 leading-tight">Hi, {firstName}</h1>
          {user && <ModeSegmented className="max-w-sm" />}
        </section>

        {isDriver && waiting.count > 0 && waiting.tripId && (
          <Link
            href={`/auth/trips/${waiting.tripId}`}
            className="flex items-center justify-between gap-3 rounded-2xl bg-[color:var(--rsu-color-primary)] px-4 py-3 font-semibold text-white"
          >
            {waiting.count} {waiting.count === 1 ? 'rider is' : 'riders are'} waiting for your answer
            <FaChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </Link>
        )}

        <section className="dashboard-main-grid">
          <div data-tour="upcoming-trips" className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className={SECTION_TITLE}>{isDriver ? 'Your next trip' : 'Your next ride'}</h2>
              {upcoming.length > 0 && (
                <Link href="/auth/trips" className="text-sm text-gray-600 hover:underline">
                  All {isDriver ? 'trips' : 'rides'}
                </Link>
              )}
            </div>

            {next ? (
              <NextRide trip={next} day={nextDay} />
            ) : (
              <div className="rsu-card flex flex-col items-start gap-3">
                <p className="text-gray-700">{isDriver ? 'You haven’t posted a trip yet.' : 'No rides yet.'}</p>
                <Link
                  href={isDriver ? '/auth/post' : '/auth/search'}
                  data-tour={isDriver ? 'post-ride' : 'find-ride'}
                  className="rsu-btn-primary"
                >
                  {isDriver ? 'Post a trip' : 'Find a ride'}
                </Link>
              </div>
            )}

            {later.length > 0 && (
              <ul className={TRIP_LIST}>
                {later.map((trip) => (
                  <TripRow
                    key={`${trip.role}-${trip.id}`}
                    href={`/auth/trips/${trip.id}`}
                    time={formatTime(trip.departureTime)}
                    title={tripRoute(trip)}
                    detail={tripWhen(trip)}
                    status={tripStatus(trip)}
                  />
                ))}
              </ul>
            )}

            {isDriver && month && (
              <Link href="/auth/driver" className="flex items-center justify-between gap-3 px-1 text-sm text-gray-600 hover:text-gray-900">
                <span>This month: {summaryLine(month)}</span>
                <FaChevronRight className="h-3 w-3 shrink-0" aria-hidden />
              </Link>
            )}
          </div>

          <aside className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className={SECTION_TITLE}>Alerts</h2>
              {alerts.length > 0 && (
                <Link href="/auth/notifications" className="text-sm text-gray-600 hover:underline">
                  All alerts
                </Link>
              )}
            </div>

            {alerts.length === 0 ? (
              <p className="px-1 text-sm text-gray-500">Nothing new.</p>
            ) : (
              <ul className={TRIP_LIST}>
                {alerts.map((alert) => (
                  <li key={alert.id} className="flex gap-3 px-4 py-3">
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${alert.isRead ? 'bg-transparent' : 'bg-[color:var(--rsu-color-primary)]'}`}
                    />
                    <span className="min-w-0">
                      <span className={`block text-sm ${alert.isRead ? 'text-gray-600' : 'font-medium text-gray-900'}`}>
                        {!alert.isRead && <span className="sr-only">Unread: </span>}
                        {shortPlace(alert.message)}
                      </span>
                      <span className="block text-xs text-gray-500" suppressHydrationWarning>
                        {formatDateTimeAgo(alert.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </section>
      </main>

      <BottomNav active="dashboard" unreadCount={unreadCount} />
    </div>
  );
}

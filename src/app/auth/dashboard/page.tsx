import React, { Suspense } from 'react';
import PushCard from '@/components/PushCard';
import ModeSegmented from '@/components/ModeSegmented';
import { summaryLine, type DriverSummary } from '@/lib/driverSummary';
import Link from 'next/link';
import { FaCar, FaSearch, FaClock } from 'react-icons/fa';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import OnboardingTour from '@/components/OnboardingTour';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import WarningBanner from '@/components/WarningBanner';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import { formatDate, formatTime, formatDateTimeAgo, recurrenceLabel, roleLabel } from '@/lib/format';

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

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Each mode's home shows only its own trips and action (sub-project C).
  const isDriver = user?.activeMode === 'DRIVER';
  let upcoming: (Trip & { role: 'Host' | 'Passenger' })[] = [];
  let alerts: Notification[] = [];
  let unreadCount = 0;
  let waiting: { count: number; tripId: string | null } = { count: 0, tripId: null };
  let month: DriverSummary['totals'] | null = null;

  if (user) {
    const [{ hosted, joined }, { notifications }] = await Promise.all([
      apiFetch<{ hosted: Trip[]; joined: Trip[] }>(`/api/trips/mine?userId=${user.id}`),
      apiFetch<{ notifications: Notification[] }>(`/api/alerts?mode=${isDriver ? 'driver' : 'passenger'}`),
    ]);
    const activeHosted = hosted.filter((t) => t.status === 'OPEN' || t.status === 'FULL');
    upcoming = isDriver
      ? activeHosted.map((t) => ({ ...t, role: 'Host' as const }))
      : joined
          .filter((t) => t.matchStatus === 'PENDING' || t.matchStatus === 'APPROVED')
          .map((t) => ({ ...t, role: 'Passenger' as const }));
    const withRequests = activeHosted.filter((t) => t.matches?.some((m) => m.status === 'PENDING'));
    waiting = {
      count: withRequests.reduce((n, t) => n + (t.matches?.filter((m) => m.status === 'PENDING').length ?? 0), 0),
      tripId: withRequests[0]?.id ?? null,
    };
    // The badge counts genuinely unread notifications; the Recent Alerts panel
    // just shows the two most recent, read or not.
    unreadCount = notifications.filter((n) => !n.isRead).length;
    // Sub-project H: this month's driving, in Driver mode.
    if (isDriver) month = (await apiFetch<DriverSummary>('/api/driver/summary?period=month')).totals;
    alerts = notifications.slice(0, 2);
  }

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
        <section>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="font-extrabold text-gray-900 leading-tight">
                Welcome back, {user?.fullName ?? 'Guest'}
              </h1>
              <p className="text-base text-gray-500 mt-2">
                {isDriver ? 'Driver mode: post trips and look after your riders' : 'Passenger mode: find a ride to campus'}
              </p>
            </div>
            {user && <Badge tone="neutral">{roleLabel(user.role)}</Badge>}
          </div>
          {user && <ModeSegmented className="mt-4 max-w-sm" />}

          <div className="dashboard-top-grid mt-6">
            {isDriver && (
            <Card data-tour="post-ride" className="border-2 border-[color:var(--rsu-color-primary)/0.18]">
              {/* Icon and text on one row; the button spans the card below them. */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 shrink-0 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FaCar className="w-5 h-5 text-[color:var(--rsu-color-primary)]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Post a Trip</h2>
                  <p className="text-sm text-gray-500">Share your vehicle and help others commute</p>
                </div>
              </div>
              <Link href="/auth/post" className="rsu-btn-primary mt-4 w-full">
                Create New Trip
              </Link>
            </Card>
            )}

            {isDriver && waiting.count > 0 && waiting.tripId && (
              <Card>
                <Link href={`/auth/trips/${waiting.tripId}`} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-gray-900">
                    {waiting.count} {waiting.count === 1 ? 'request' : 'requests'} waiting for your answer
                  </span>
                  <span className="text-sm text-[color:var(--rsu-color-primary)] font-semibold">Review</span>
                </Link>
              </Card>
            )}

            {isDriver && month && (
              <Card>
                <Link href="/auth/driver" className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">This month: {summaryLine(month)}</span>
                    <span className="block text-xs text-gray-500">Fuel share from riders, paid in person</span>
                  </span>
                  <span className="shrink-0 text-sm text-[color:var(--rsu-color-primary)] font-semibold">My driving</span>
                </Link>
              </Card>
            )}

            {!isDriver && (
            <Card data-tour="find-ride">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 shrink-0 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FaSearch className="w-5 h-5 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Find a Ride</h2>
                  <p className="text-sm text-gray-500">Search for available carpools to join</p>
                </div>
              </div>
              <Link href="/auth/search" className="rsu-btn-primary mt-4 w-full">
                Search Rides
              </Link>
            </Card>
            )}
          </div>
        </section>

        <section className="dashboard-main-grid mt-6">
          <div data-tour="upcoming-trips">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">{isDriver ? 'Trips You’re Driving' : 'Your Upcoming Rides'}</h3>
              <Link href="/auth/trips" className="text-sm text-gray-600 hover:underline">
                View All
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <Card>
                <div className="flex flex-col items-center py-8">
                  <FaClock className="rsu-empty-icon mb-4" />
                  <p className="text-gray-600 font-medium text-base">{isDriver ? 'No trips posted yet' : 'No upcoming rides'}</p>
                  <p className="text-sm text-gray-400 mt-2">{isDriver ? 'Post a trip to offer your empty seats' : 'Find a ride to get started'}</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcoming.map((trip) => (
                  <Card key={`${trip.role}-${trip.id}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="flex items-center gap-1.5">
                        <Badge tone={trip.role === 'Host' ? 'primary' : 'success'}>{trip.role}</Badge>
                        {trip.inProgress && <Badge tone="info">In progress</Badge>}
                      </span>
                      <span className="text-xs text-gray-400">{recurrenceLabel(trip.recurrenceType)}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {trip.originAddress} → {trip.destinationAddress}
                    </p>
                    <p className="text-xs text-gray-500 mt-1" suppressHydrationWarning>
                      {formatTime(trip.departureTime)} · {formatDate(trip.departureTime)} · {trip.vehicle.make}{' '}
                      {trip.vehicle.model} ({trip.vehicle.color})
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <aside>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Recent Alerts</h3>
              <Link href="/auth/notifications" className="text-sm text-gray-600 hover:underline">
                View All
              </Link>
            </div>

            {alerts.length === 0 ? (
              <Card>
                <p className="text-sm text-gray-400 text-center py-4">No notifications yet.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <Card key={alert.id}>
                    <p className="text-sm font-medium text-gray-800">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-2" suppressHydrationWarning>
                      {formatDateTimeAgo(alert.createdAt)}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </aside>
        </section>
      </main>

      <BottomNav active="dashboard" unreadCount={unreadCount} />
    </div>
  );
}

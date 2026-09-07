import React from 'react';
import Link from 'next/link';
import { FaCar, FaSearch, FaClock } from 'react-icons/fa';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
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
  originAddress: string;
  destinationAddress: string;
  departureTime: string;
  recurrenceType: string;
  totalSeats: number;
  filledSeats: number;
  vehicle: Vehicle;
  status: string;
  matchStatus?: string;
}

interface Notification {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  let upcoming: (Trip & { role: 'Host' | 'Passenger' })[] = [];
  let alerts: Notification[] = [];
  let unreadCount = 0;

  if (user) {
    const [{ hosted, joined }, { notifications }] = await Promise.all([
      apiFetch<{ hosted: Trip[]; joined: Trip[] }>(`/api/trips/mine?userId=${user.id}`),
      apiFetch<{ notifications: Notification[] }>(`/api/alerts?userId=${user.id}`),
    ]);
    upcoming = [
      ...hosted.filter((t) => t.status === 'OPEN').map((t) => ({ ...t, role: 'Host' as const })),
      ...joined
        .filter((t) => t.matchStatus === 'PENDING' || t.matchStatus === 'APPROVED')
        .map((t) => ({ ...t, role: 'Passenger' as const })),
    ];
    // The badge counts genuinely unread notifications; the Recent Alerts panel
    // just shows the two most recent, read or not.
    unreadCount = notifications.filter((n) => !n.isRead).length;
    alerts = notifications.slice(0, 2);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between pb-24">
      <Header active="dashboard" unreadCount={unreadCount} />

      <main className="app-desktop w-full p-0 pt-2 md:pt-4 space-y-6 flex-grow">
        <section>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="font-extrabold text-gray-900 leading-tight">
                Welcome back, {user?.fullName ?? 'Guest'}
              </h1>
              <p className="text-base text-gray-500 mt-2">Manage your carpools and find ride opportunities</p>
            </div>
            {user && <Badge tone="neutral">{roleLabel(user.role)}</Badge>}
          </div>

          <div className="dashboard-top-grid mt-6">
            <Card className="border-2 border-[color:var(--rsu-color-primary)/0.18]">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-white rounded-md">
                  <FaCar className="w-5 h-5 text-[color:var(--rsu-color-primary)]" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Post a Ride</h2>
                  <p className="text-sm text-gray-500 mt-0 mb-4">Share your vehicle and help others commute</p>
                  <Link href="/auth/post" className="rsu-btn-primary w-full md:w-auto">
                    Create New Trip
                  </Link>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FaSearch className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Find a Ride</h2>
                  <p className="text-sm text-gray-500 mt-0 mb-4">Search for available carpools to join</p>
                  <Link href="/auth/search" className="rsu-btn-secondary w-full md:w-48">
                    Search Rides
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="dashboard-main-grid mt-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Trips</h3>
              <Link href="/auth/trips" className="text-sm text-gray-600 hover:underline">
                View All
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <Card>
                <div className="flex flex-col items-center py-8">
                  <FaClock className="rsu-empty-icon mb-4" />
                  <p className="text-gray-600 font-medium text-base">No upcoming trips</p>
                  <p className="text-sm text-gray-400 mt-2">Post a ride or find one to get started</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcoming.map((trip) => (
                  <Card key={`${trip.role}-${trip.id}`}>
                    <div className="flex justify-between items-start mb-2">
                      <Badge tone={trip.role === 'Host' ? 'primary' : 'success'}>{trip.role}</Badge>
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

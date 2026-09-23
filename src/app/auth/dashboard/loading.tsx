import React from 'react';
import Link from 'next/link';
import { FaCar, FaSearch } from 'react-icons/fa';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Card from '@/components/Card';
import Skeleton from '@/components/Skeleton';

// DashboardPage is one async Server Component (data + JSX in a single
// return), so nothing on the page can render until its fetches resolve --
// including copy that never actually changes. Rather than skeleton the
// whole page, this reproduces every piece that's genuinely static (the
// "Post a Ride"/"Find a Ride" cards, section titles, "View All" links) as
// real markup, and only skeletons what's actually derived from data: the
// personalized greeting, the role badge, and the two trip/alert lists.
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between pb-24">
      <Header active="dashboard" />

      <main className="app-desktop w-full p-0 pt-2 md:pt-4 space-y-6 flex-grow">
        <section>
          <div className="flex justify-between items-start">
            <div>
              <Skeleton shape="text" width={220} height={22} className="mb-2" />
              <p className="text-base text-gray-500 mt-2">Manage your carpools and find ride opportunities</p>
            </div>
            <Skeleton shape="rect" width={64} height={22} radius="9999px" />
          </div>

          <div className="dashboard-top-grid mt-6">
            <Card data-tour="post-ride" className="border-2 border-[color:var(--rsu-color-primary)/0.18]">
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

            <Card data-tour="find-ride">
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
          <div data-tour="upcoming-trips">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Trips</h3>
              <Link href="/auth/trips" className="text-sm text-gray-600 hover:underline">
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <div className="flex justify-between items-start mb-2">
                    <Skeleton shape="rect" width={54} height={18} radius="9999px" />
                    <Skeleton shape="text" width={50} height={10} />
                  </div>
                  <Skeleton shape="text" width="75%" height={13} className="mb-2" />
                  <Skeleton shape="text" width="55%" height={11} />
                </Card>
              ))}
            </div>
          </div>

          <aside>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Recent Alerts</h3>
              <Link href="/auth/notifications" className="text-sm text-gray-600 hover:underline">
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <Skeleton shape="text" width="85%" height={12} className="mb-2" />
                  <Skeleton shape="text" width={70} height={10} />
                </Card>
              ))}
            </div>
          </aside>
        </section>
      </main>

      <BottomNav active="dashboard" />
    </div>
  );
}

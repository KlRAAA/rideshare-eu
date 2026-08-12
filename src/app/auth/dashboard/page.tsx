'use client';

import React from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const userName = "Von De Asis"; 
  const userRole = "Student";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between pb-24">
      <header className="bg-white border-b border-gray-100 py-2 sticky top-0 z-10 shadow-sm">
        <div className="app-desktop flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#800000] text-white rounded-lg flex items-center justify-center font-extrabold text-sm shadow header-logo-only">
              EU
            </div>
            <span className="font-extrabold text-gray-900 header-title truncate">RideShareEU</span>
          </div>

          {/* Desktop nav links */}
          <nav className="rsu-topnav flex-1 min-w-0 justify-end hidden md:flex">
            <a href="/auth/dashboard" className="active">Dashboard</a>
            <a href="/auth/trips">My Trips</a>
            <a href="/auth/notifications">Notifications<span className="ml-1 inline-flex items-center justify-center bg-red-600 text-white text-[10px] rounded-full px-2">2</span></a>
            <a href="/auth/profile">Profile</a>
          </nav>

          {/* Mobile header notification icon */}
          <Link
            href="/auth/notifications"
            className="md:hidden relative flex items-center justify-center w-9 h-9 text-gray-600 hover:text-gray-800"
            aria-label="Notifications"
          >
            <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.21 1.04-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">2</span>
          </Link>
        </div>
      </header>

      <main className="app-desktop w-full p-0 pt-4 space-y-6 flex-grow">
        <section>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="font-extrabold text-gray-900 leading-tight">
                Welcome back, {userName}
              </h1>
              <p className="text-base text-gray-500 mt-2">
                Manage your carpools and find ride opportunities
              </p>
            </div>
            <div>
              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full border border-gray-200 shadow-sm">
                {userRole}
              </span>
            </div>
          </div>

          <div className="dashboard-top-grid mt-6">
            <div className="rsu-card border-2 border-[color:var(--rsu-color-primary)/0.18]">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-[#fff] rounded-md">
                  <svg className="w-5 h-5 text-[#800000]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h2l1 5h12l1-5h2"/></svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Post a Ride</h2>
                  <p className="text-sm text-gray-500 mt-0 mb-4">Share your vehicle and help others commute</p>
                  <Link href="/auth/post" className="rsu-btn-primary w-full md:w-auto">Create New Trip</Link>
                </div>
              </div>
            </div>

            <div className="rsu-card">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Find a Ride</h2>
                  <p className="text-sm text-gray-500 mt-0 mb-4">Search for available carpools to join</p>
                  <Link href="/auth/search" className="inline-block w-full md:w-48 px-4 py-3 bg-white border border-gray-300 text-gray-700 text-center font-medium rounded-lg text-sm hover:bg-gray-50 transition-colors">Search Rides</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-main-grid mt-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Trips</h3>
              <a href="#" className="text-sm text-gray-600 hover:underline">View All</a>
            </div>

            <div className="rsu-card">
              <div className="flex flex-col items-center py-8">
                <svg className="rsu-empty-icon mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3"/></svg>
                <p className="text-gray-600 font-medium text-base">No upcoming trips</p>
                <p className="text-sm text-gray-400 mt-2">Post a ride or find one to get started</p>
              </div>
            </div>
          </div>

          <aside>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Recent Alerts</h3>
              <a href="#" className="text-sm text-gray-600 hover:underline">View All</a>
            </div>

            <div className="space-y-3">
              <div className="rsu-card">
                <p className="text-sm font-medium text-gray-800">Alyssa Reyes requested to join your trip to Enverga University on March 27</p>
                <p className="text-xs text-gray-400 mt-2">3/25/2026, 10:30:00 AM</p>
              </div>
              <div className="rsu-card">
                <p className="text-sm font-medium text-gray-800">Your request to join Xyrus Dimacali's trip has been approved</p>
                <p className="text-xs text-gray-400 mt-2">3/25/2026, 9:15:00 AM</p>
              </div>
            </div>
          </aside>
        </section>
      </main>

      {/* Mobile bottom nav — icons above labels, matching the reference design */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-4 flex justify-between items-center w-full z-20 shadow-lg md:hidden">
        <Link href="/auth/dashboard" className="flex flex-col items-center text-[#800000]">
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7m-9-2v10a1 1 0 001 1h3m-4-11l9 9m-9-9v10a1 1 0 001 1h3m0 0h4a1 1 0 001-1V10m-6 11v-6a1 1 0 011-1h2a1 1 0 011 1v6" />
          </svg>
          <span className="text-xs font-medium mt-0.5">Dashboard</span>
        </Link>
        <Link href="/auth/trips" className="flex flex-col items-center text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h2l1 5h12l1-5h2M5 12l1.5 6h11L19 12M8 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          <span className="text-xs font-medium mt-0.5">My Trips</span>
        </Link>
        <Link href="/auth/notifications" className="flex flex-col items-center text-gray-400 hover:text-gray-600 relative">
          <span className="absolute -top-1 right-0 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">2</span>
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.21 1.04-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-xs font-medium mt-0.5">Notifications</span>
        </Link>
        <Link href="/auth/profile" className="flex flex-col items-center text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
          </svg>
          <span className="text-xs font-medium mt-0.5">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
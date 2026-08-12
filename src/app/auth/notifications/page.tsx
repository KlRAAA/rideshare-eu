'use client';

import React from 'react';
import Link from 'next/link';

export default function NotificationsPage() {
  // Simulated alerts based on the thesis notification requirements[cite: 1]
const notifications = [
    {
      id: 'n1',
      type: 'Match Request',
      message: 'Alyssa Reyes requested to join your trip to Enverga University on March 27.',
      time: '10:30 AM',
      isRead: false,
    },
    {
      id: 'n2',
      type: 'Approval',
      // FIX: Wrapped the string in double quotes to allow the single apostrophe inside
      message: "Your request to join Xyrus Dimacali's trip has been approved. View fuel share details.",
      time: 'Yesterday',
      isRead: true,
    },
    {
      id: 'n3',
      type: 'Rating Prompt',
      message: 'Your trip with Kyla Velasco is complete. Please submit a rating to update their trust score.',
      time: 'Mar 24',
      isRead: true,
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6 overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#800000]">Notifications</p>
              <h1 className="mt-2 text-3xl font-extrabold text-slate-950">You have 2 unread notifications</h1>
            </div>
            <button className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">
              Mark all as read
            </button>
          </div>
        </section>

        <section className="space-y-4">
          {notifications.map((notif) => (
            <article key={notif.id} className={`overflow-hidden rounded-[28px] border p-5 shadow-sm transition ${notif.isRead ? 'border-slate-200 bg-slate-50' : 'border-[#800000]/20 bg-white'}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`mt-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold ${notif.isRead ? 'bg-slate-100 text-slate-500' : 'bg-[#800000] text-white'}`}>
                    {notif.type === 'Match Request' ? 'M' : notif.type === 'Approval' ? 'A' : 'R'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-slate-950 leading-7">{notif.message}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{notif.time}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{notif.type}</span>
                {!notif.isRead && (
                  <span className="inline-flex rounded-full bg-[#fce7f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9f1239]">Unread</span>
                )}
              </div>
              {!notif.isRead && notif.type === 'Match Request' && (
                <div className="mt-5">
                  <button className="inline-flex items-center justify-center rounded-2xl bg-[#800000] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#660000]">
                    Review Request
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 shadow-[0_-1px_0_0_rgba(15,23,42,0.06)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/auth/dashboard" className="flex flex-1 items-center justify-center rounded-3xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
            Dashboard
          </Link>
          <Link href="/auth/trips" className="flex flex-1 items-center justify-center rounded-3xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
            My Trips
          </Link>
          <Link href="/auth/notifications" className="flex flex-1 items-center justify-center rounded-3xl bg-[#f7f3f2] px-3 py-2 text-sm font-semibold text-[#800000] shadow-sm">
            <span className="relative">Notifications
              <span className="absolute -top-1 right-[-0.7rem] inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#b91c1c] px-1.5 text-[10px] font-bold text-white">2</span>
            </span>
          </Link>
          <Link href="/auth/profile" className="flex flex-1 items-center justify-center rounded-3xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
            Profile
          </Link>
        </div>
      </nav>
    </div>
  );
}
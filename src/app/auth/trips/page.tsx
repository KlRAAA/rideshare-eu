'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function MyTripsPage() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');

  // Simulated trip records reflecting manuscript data specifications
  const upcomingHostedTrips = [
    {
      id: 't1',
      role: 'Host',
      origin: 'Tayabas, Quezon',
      destination: 'Enverga University, Lucena',
      departureTime: '07:30 AM',
      date: 'Mar 27, 2026',
      recurrence: 'specific',
      totalSeats: 3,
      filledSeats: 0,
      vehicle: 'Mitsubishi Mirage (Red)',
      status: 'Open'
    }
  ];

  const upcomingPassengerTrips = [
    {
      id: 't2',
      role: 'Passenger',
      hostName: 'Xyrus Dimacali',
      origin: 'Lucban, Quezon',
      destination: 'Enverga University, Lucena',
      departureTime: '07:00 AM',
      date: 'Mar 26, 2026',
      recurrence: 'weekdays',
      totalSeats: 3,
      filledSeats: 1,
      vehicle: 'Toyota Vios (White)',
      status: 'Open'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-[#800000] text-white rounded-lg flex items-center justify-center font-bold text-sm shadow">
            EU
          </div>
          <span className="font-bold text-gray-900 text-lg">RideShareEU</span>
        </div>
        <Link href="/auth/dashboard" className="text-xs font-semibold text-[#800000] hover:underline">
          Dashboard
        </Link>
      </header>

      {/* Main Container */}
      <main className="max-w-md w-full mx-auto p-4 space-y-6 flex-grow">
        
        {/* Page Title */}
        <div className="pt-2">
          <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
          <p className="text-sm text-gray-500 mt-0.5">View and manage your hosted rides and joined trips</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-gray-200/70 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'upcoming' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'past' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Past
          </button>
          <button
            onClick={() => setActiveTab('cancelled')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'cancelled' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Cancelled
          </button>
        </div>

        {/* Tab Content: Upcoming */}
        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            
            {/* Hosted Trips Section */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Hosted Rides</h3>
              {upcomingHostedTrips.length > 0 ? (
                upcomingHostedTrips.map((trip) => (
                  <div key={trip.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="px-2.5 py-1 bg-[#800000]/10 text-[#800000] text-[10px] font-bold rounded-full">
                        Host
                      </span>
                      <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-lg border border-green-200">
                        {trip.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p><span className="font-semibold">Route:</span> {trip.origin} to {trip.destination}</p>
                      <p><span className="font-semibold">Schedule:</span> {trip.departureTime} ({trip.date} - {trip.recurrence})</p>
                      <p><span className="font-semibold">Vehicle:</span> {trip.vehicle}</p>
                      <p><span className="font-semibold">Capacity:</span> {trip.totalSeats} seats available ({trip.filledSeats}/{trip.totalSeats} filled)</p>
                    </div>

                    <button className="w-full py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                      Manage Trip & Requests
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-4 bg-white rounded-xl border border-gray-200">No hosted trips found.</p>
              )}
            </div>

            {/* Passenger Bookings Section */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Joined Rides</h3>
              {upcomingPassengerTrips.length > 0 ? (
                upcomingPassengerTrips.map((trip) => (
                  <div key={trip.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full">
                        Passenger (Host: {trip.hostName})
                      </span>
                      <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-lg border border-green-200">
                        Approved
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p><span className="font-semibold">Route:</span> {trip.origin} to {trip.destination}</p>
                      <p><span className="font-semibold">Schedule:</span> {trip.departureTime} ({trip.date})</p>
                      <p><span className="font-semibold">Vehicle:</span> {trip.vehicle}</p>
                    </div>

                    <button className="w-full py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                      View Meeting Point & Fuel Share
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-4 bg-white rounded-xl border border-gray-200">No joined trips found.</p>
              )}
            </div>

          </div>
        )}

        {activeTab === 'past' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center space-y-2">
            <p className="text-xs text-gray-400">No past trips recorded yet. Completed trips will appear here for rating prompts.</p>
          </div>
        )}

        {activeTab === 'cancelled' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center space-y-2">
            <p className="text-xs text-gray-400">No cancelled trips.</p>
          </div>
        )}

      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-6 flex justify-between items-center max-w-md mx-auto z-20 shadow-lg">
        <Link href="/auth/dashboard" className="flex flex-col items-center text-gray-400 hover:text-gray-600">
          <span className="text-[10px] font-medium mt-0.5">Dashboard</span>
        </Link>
        <Link href="/auth/trips" className="flex flex-col items-center text-[#800000]">
          <span className="text-[10px] font-medium mt-0.5">My Trips</span>
        </Link>
        <Link href="/auth/notifications" className="flex flex-col items-center text-gray-400 hover:text-gray-600 relative">
          <span className="absolute -top-1 right-0 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">2</span>
          <span className="text-[10px] font-medium mt-0.5">Notifications</span>
        </Link>
        <Link href="/auth/profile" className="flex flex-col items-center text-gray-400 hover:text-gray-600">
          <span className="text-[10px] font-medium mt-0.5">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
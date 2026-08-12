'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function SearchRidesPage() {
  const [origin, setOrigin] = useState('');
  const [destination] = useState('Enverga University, Lucena City');
  const [genderPref, setGenderPref] = useState('Any');
  const [flexibleTime, setFlexibleTime] = useState(true);
  const [searched, setSearched] = useState(false);

  // Simulated PSGA Match Results based on thesis specifications
  const mockMatches = [
    {
      id: 'm1',
      hostName: 'Xyrus Dimacali',
      role: 'Faculty',
      matchScore: 95,
      origin: 'Lucban, Quezon',
      destination: 'Enverga University, Lucena',
      time: '07:00 AM',
      date: 'Mar 26, 2026',
      recurrence: 'weekdays',
      seatsAvailable: 2,
      totalSeats: 3,
      vehicle: 'Toyota Vios (White)',
      fuelShare: '₱65.00'
    },
    {
      id: 'm2',
      hostName: 'Kyla Velasco',
      role: 'Student',
      matchScore: 92,
      origin: 'Tiaong, Quezon',
      destination: 'Enverga University, Lucena',
      time: '08:00 AM',
      date: 'Mar 26, 2026',
      recurrence: 'specific',
      seatsAvailable: 1,
      totalSeats: 2,
      vehicle: 'Suzuki Swift (Blue)',
      fuelShare: '₱85.00'
    }
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-[#800000] text-white rounded-lg flex items-center justify-center font-bold text-sm shadow">
            EU
          </div>
          <span className="font-bold text-gray-900 text-lg">RideShareEU</span>
        </div>
        <Link href="/auth/dashboard" className="text-xs font-semibold text-[#800000] hover:underline">
          Back to Dashboard
        </Link>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-5xl mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Search Filter Sidebar */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 h-fit">
          <h2 className="text-base font-bold text-gray-900">Find a Ride</h2>
          <p className="text-xs text-gray-500">Search for available carpools that match your route</p>

          <form onSubmit={handleSearch} className="space-y-3 pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">Origin</label>
              <input
                type="text"
                required
                placeholder="e.g., Lucban, Tayabas"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#800000]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">Destination</label>
              <input
                type="text"
                disabled
                value={destination}
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-xl text-xs text-gray-600 cursor-not-allowed"
              />
            </div>

            <div className="border-t border-gray-100 pt-3">
              <span className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-2">PSGA Filters</span>
              
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Gender Preference</label>
                  <select
                    value={genderPref}
                    onChange={(e) => setGenderPref(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none"
                  >
                    <option value="Any">Any</option>
                    <option value="Same-Gender">Same-Gender Only</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-gray-500">Flexible Time (±30 min)</span>
                  <input
                    type="checkbox"
                    checked={flexibleTime}
                    onChange={(e) => setFlexibleTime(e.target.checked)}
                    className="accent-[#800000]"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#800000] text-white text-xs font-semibold rounded-xl shadow hover:bg-[#600000] transition-colors mt-3"
            >
              Run PSGA Search
            </button>
          </form>
        </div>

        {/* Results Area */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-900">
              {searched ? `${mockMatches.length} rides available via PSGA` : 'Enter parameters to view ranked matches'}
            </h3>
            <span className="text-xs text-gray-500 bg-white border border-gray-200 px-3 py-1 rounded-full shadow-sm">
              Sorted by: Best Match Score
            </span>
          </div>

          {mockMatches.map((match) => (
            <div key={match.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-100 text-gray-700 rounded-full flex items-center justify-center font-bold text-sm border border-gray-200">
                    {match.hostName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-gray-900">{match.hostName}</h4>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-medium rounded-full border">
                        {match.role}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600">{match.matchScore}% PSGA Match</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-lg border border-green-200">
                  Open
                </span>
              </div>

              <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p><span className="font-semibold">Route:</span> {match.origin} to {match.destination}</p>
                <p><span className="font-semibold">Schedule:</span> {match.time} ({match.date} - {match.recurrence})</p>
                <p><span className="font-semibold">Vehicle:</span> {match.vehicle} ({match.seatsAvailable} seats available)</p>
                <p><span className="font-semibold text-[#800000]">Suggested Fuel Share:</span> {match.fuelShare} per passenger</p>
              </div>

              <div className="flex space-x-2 pt-1">
                <button className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                  View Details & Map
                </button>
                <button className="flex-1 py-2 bg-[#800000] text-white text-xs font-semibold rounded-xl shadow hover:bg-[#600000] transition-colors">
                  Request to Join
                </button>
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
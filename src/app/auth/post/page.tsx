'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function PostTripPage() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('Enverga University, Lucena City');
  const [departureTime, setDepartureTime] = useState('07:30');
  const [recurrence, setRecurrence] = useState('weekdays');
  const [seats, setSeats] = useState(3);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePostTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Future API Integration: POST /api/trips
    setTimeout(() => setLoading(false), 1000); 
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-24 p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <Link href="/auth/dashboard" className="text-xs font-semibold text-[#800000] hover:underline">
          ← Back to Dashboard
        </Link>
      </header>

      <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
        <div className="border-b border-gray-100 pb-4">
          <h1 className="text-xl font-bold text-gray-900">Post a New Trip</h1>
          <p className="text-xs text-gray-500 mt-0.5">Share your vehicle and split fuel costs along your route</p>
        </div>

        <form onSubmit={handlePostTrip} className="space-y-4">
          {/* Routing Inputs */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Origin (Barangay / Town)</label>
            <input
              type="text"
              required
              placeholder="e.g., Lucban, Quezon or Tayabas"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#800000] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Destination</label>
            <input
              type="text"
              disabled
              value={destination}
              className="w-full px-3 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-sm text-gray-600 cursor-not-allowed"
            />
          </div>

          {/* Schedule & Recurrence Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Departure Time</label>
              <input
                type="time"
                required
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Recurrence</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none"
              >
                <option value="specific">Specific Date</option>
                <option value="weekdays">Weekdays (Mon-Fri)</option>
                <option value="daily">Daily</option>
              </select>
            </div>
          </div>

          {/* Vehicle Inputs */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">Vehicle Details</label>
              <input
                type="text"
                required
                placeholder="e.g., Toyota Vios (White)"
                value={`${vehicleMake} ${vehicleModel}`}
                onChange={(e) => {
                  const parts = e.target.value.split(' ');
                  setVehicleMake(parts[0] || '');
                  setVehicleModel(parts.slice(1).join(' '));
                }}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">Available Seats</label>
              <input
                type="number"
                min="1"
                max="6"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#800000] text-white text-sm font-semibold rounded-xl shadow hover:bg-[#600000] transition-colors mt-4"
          >
            {loading ? 'Publishing Trip...' : 'Publish Recurring Trip'}
          </button>
        </form>
      </div>
    </main>
  );
}
'use client';

import React from 'react';
import Link from 'next/link';

export default function TripDetailsPage() {
  // Simulated match data demonstrating Fuel Share calculation requirements[cite: 1]
  const tripDetails = {
    host: 'Xyrus Dimacali',
    role: 'Faculty',
    trustScore: 4.9,
    origin: 'Lucban, Quezon',
    destination: 'Enverga University, Lucena',
    time: '07:00 AM',
    vehicle: 'Toyota Vios (White)',
    plate: 'ABC 1234',
    distanceKm: 24.5,
    fuelSharePhp: 65.00, // Derived from: (DistanceKm / FuelEfficiency) x FuelPricePerLiter / (1 + FilledSeats)[cite: 1]
    passengers: ['Von De Asis (You)', 'Nash Sayat']
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <Link href="/auth/trips" className="text-xs font-semibold text-[#800000] hover:underline">← Back to Trips</Link>
        <span className="font-bold text-gray-900 text-sm">Trip Details</span>
      </header>

      <main className="max-w-md w-full mx-auto p-4 space-y-4 pt-6">
        
        {/* Interactive Map Placeholder (Von's Integration Task) */}
        <div className="w-full h-48 bg-gray-200 rounded-2xl border border-gray-300 flex items-center justify-center shadow-inner overflow-hidden relative">
          <div className="absolute inset-0 opacity-50 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=Lucena,Philippines&zoom=12&size=600x300&key=YOUR_API_KEY')] bg-cover bg-center"></div>
          <span className="relative z-10 bg-white/90 px-3 py-1 rounded-lg text-xs font-bold text-gray-700 shadow">Map Integration Pending</span>
        </div>

        {/* Core Trip Info */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Host: {tripDetails.host}</h2>
              <p className="text-[10px] text-gray-500">{tripDetails.role} • ★ {tripDetails.trustScore} Trust Score</p>
            </div>
            <span className="px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-200">Confirmed</span>
          </div>
          
          <div className="text-xs text-gray-600 space-y-2 pt-1">
            <p><span className="font-semibold block text-gray-800">Route</span> {tripDetails.origin} → {tripDetails.destination}</p>
            <p><span className="font-semibold block text-gray-800">Schedule</span> {tripDetails.time} (Weekdays)</p>
            <p><span className="font-semibold block text-gray-800">Vehicle</span> {tripDetails.vehicle} • Plate: {tripDetails.plate}</p>
          </div>
        </div>

        {/* Fuel Share Breakdown Panel */}
        <div className="bg-[#800000] text-white rounded-2xl p-5 shadow-md">
          <h3 className="text-sm font-bold mb-1">Voluntary Fuel Share</h3>
          <p className="text-[10px] text-white/80 mb-4">Calculated based on distance and current occupancy</p>
          
          <div className="flex justify-between items-end border-t border-white/20 pt-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/70">Your Contribution</p>
              <p className="text-2xl font-bold">₱{tripDetails.fuelSharePhp.toFixed(2)}</p>
            </div>
            <button className="px-4 py-2 bg-white text-[#800000] text-xs font-bold rounded-xl shadow-sm hover:bg-gray-100">
              Message Host
            </button>
          </div>
        </div>

        {/* Co-Rider Roster */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Co-Rider Roster</h3>
          <ul className="space-y-2">
            {tripDetails.passengers.map((passenger, idx) => (
              <li key={idx} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
                <div className="w-6 h-6 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-[10px] font-bold">
                  {passenger.charAt(0)}
                </div>
                <span className="text-xs font-medium text-gray-800">{passenger}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
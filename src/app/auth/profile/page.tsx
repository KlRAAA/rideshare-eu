'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ProfilePage() {
  const [genderPref, setGenderPref] = useState('Any');
  const [flexWindow, setFlexWindow] = useState(15);
  const [familiarOnly, setFamiliarOnly] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 flex flex-col">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-[#800000] text-white rounded-lg flex items-center justify-center font-bold text-sm shadow">EU</div>
          <span className="font-bold text-gray-900 text-lg">Profile</span>
        </div>
      </header>

      <main className="max-w-md w-full mx-auto p-4 space-y-6 flex-grow pt-6">
        
        {/* Identity & Trust Panel */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-center">
          <div className="w-16 h-16 bg-[#800000] text-white text-xl font-bold rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
            VA
          </div>
          <h2 className="text-lg font-bold text-gray-900">Von Altair R. De Asis</h2>
          <span className="inline-block px-3 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-200 mt-1">
            Verified Student • ICTD Authenticated
          </span>
          
          <div className="flex justify-center items-center space-x-6 mt-5 pt-4 border-t border-gray-100">
            <div>
              <p className="text-2xl font-bold text-[#800000]">4.8</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Trust Score</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">14</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Trips Shared</p>
            </div>
          </div>
        </div>

        {/* PSGA Preference Variables */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Matching Preferences</h3>
          <p className="text-[11px] text-gray-500">These settings influence your PSGA Stage 2 rankings.</p>
          
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">Co-Rider Gender</label>
              <select 
                value={genderPref} onChange={(e) => setGenderPref(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none"
              >
                <option value="Any">Any Gender</option>
                <option value="Same-Gender">Same-Gender Only</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Flexibility Window: ±{flexWindow} mins
              </label>
              <input 
                type="range" min="0" max="60" step="5" value={flexWindow} onChange={(e) => setFlexWindow(Number(e.target.value))}
                className="w-full accent-[#800000]"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider">Familiar Riders Only</label>
                <p className="text-[10px] text-gray-500">Only match with users you have ridden with before.</p>
              </div>
              <input type="checkbox" checked={familiarOnly} onChange={(e) => setFamiliarOnly(e.target.checked)} className="w-4 h-4 accent-[#800000]" />
            </div>
          </div>
          
          <button className="w-full py-2.5 bg-[#800000] text-white text-xs font-semibold rounded-xl shadow mt-2">
            Save Preferences
          </button>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-6 flex justify-between items-center max-w-md mx-auto z-20 shadow-lg">
        <Link href="/auth/dashboard" className="flex flex-col items-center text-gray-400 hover:text-gray-600"><span className="text-[10px] font-medium mt-0.5">Dashboard</span></Link>
        <Link href="/auth/trips" className="flex flex-col items-center text-gray-400 hover:text-gray-600"><span className="text-[10px] font-medium mt-0.5">My Trips</span></Link>
        <Link href="/auth/notifications" className="flex flex-col items-center text-gray-400 hover:text-gray-600"><span className="text-[10px] font-medium mt-0.5">Notifications</span></Link>
        <Link href="/auth/profile" className="flex flex-col items-center text-[#800000]"><span className="text-[10px] font-medium mt-0.5">Profile</span></Link>
      </nav>
    </div>
  );
}
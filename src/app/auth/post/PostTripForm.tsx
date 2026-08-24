'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaSpinner } from 'react-icons/fa';
import RouteMap from '@/components/RouteMap';
import Listbox from '@/components/Listbox';
import DatePicker from '@/components/DatePicker';
import TimePicker from '@/components/TimePicker';
import { apiFetch } from '@/lib/api';
import { getPhTodayDateString, getPhNowTimeString } from '@/lib/format';

const SEAT_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} seat${n > 1 ? 's' : ''}` }));
const GENDER_PREFERENCE_OPTIONS: { value: 'ANY' | 'SAME_GENDER'; label: string }[] = [
  { value: 'ANY', label: 'Any' },
  { value: 'SAME_GENDER', label: 'Same-gender only' },
];

type Recurrence = 'ONE_TIME' | 'DAILY' | 'WEEKDAYS' | 'CUSTOM';

interface Coords {
  lat: number;
  lng: number;
}

const RECURRENCE_OPTIONS: { value: Recurrence; label: string; hint: string }[] = [
  { value: 'ONE_TIME', label: 'One-time', hint: 'Just this single trip, no repeat' },
  { value: 'DAILY', label: 'Daily', hint: 'Every day including weekends' },
  { value: 'WEEKDAYS', label: 'Weekdays only', hint: 'Monday to Friday, repeating each week' },
  { value: 'CUSTOM', label: 'Custom days', hint: 'You choose which days of the week' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function useGeocodedAddress(query: string) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setCoords(null);
      return;
    }
    setResolving(true);
    const timer = setTimeout(async () => {
      try {
        const result = await apiFetch<Coords & { displayName: string }>(`/api/geocode?q=${encodeURIComponent(query)}`);
        setCoords({ lat: result.lat, lng: result.lng });
      } catch {
        setCoords(null);
      } finally {
        setResolving(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [query]);

  return { coords, resolving };
}

export default function PostTripForm({ hostId }: { hostId: string }) {
  const router = useRouter();

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('Enverga University, Lucena City');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('07:00');
  const [recurrence, setRecurrence] = useState<Recurrence>('ONE_TIME');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [seats, setSeats] = useState(1);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [fuelEfficiency, setFuelEfficiency] = useState('');
  const [fuelShare, setFuelShare] = useState('');
  const [driverNotes, setDriverNotes] = useState('');
  const [genderPreference, setGenderPreference] = useState<'ANY' | 'SAME_GENDER'>('ANY');
  const [flexibleDeparture, setFlexibleDeparture] = useState(false);
  const [familiarRidersOnly, setFamiliarRidersOnly] = useState(false);
  const [meetingPointAddress, setMeetingPointAddress] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `disabled={isSubmitting}` alone has a real gap: a second click fired
  // before React re-renders with the disabled button reads `isSubmitting`
  // from the same stale closure as the first, since state updates aren't
  // synchronous. A ref updates immediately, so this is the actual guard;
  // the state is just what drives the visible disabled/spinner UI.
  const isSubmittingRef = useRef(false);

  const { coords: originCoords } = useGeocodedAddress(origin);
  const { coords: destinationCoords } = useGeocodedAddress(destination);
  const { coords: meetingCoords } = useGeocodedAddress(meetingPointAddress);

  function toggleCustomDay(day: number) {
    setCustomDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    setError(null);

    if (!originCoords || !destinationCoords) {
      setError('Enter an origin and destination we can find on the map before publishing.');
      return;
    }
    if (!date || !time) {
      setError('Pick a date and departure time.');
      return;
    }
    // Defense in depth alongside the date/time fields' `min` attributes —
    // those can still be bypassed (typed manually, or time simply elapsing
    // between page load and submit), so re-check here in the same PH-anchored
    // way the actual departureTime below is computed.
    if (new Date(`${date}T${time}:00+08:00`) < new Date()) {
      setError('That departure time has already passed. Pick a time in the future.');
      return;
    }
    if (!vehicleMake || !vehicleModel || !vehicleColor || !fuelEfficiency) {
      setError('Fill in your vehicle details, including fuel efficiency — it drives the fuel share estimate.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const { vehicle } = await apiFetch<{ vehicle: { id: string } }>('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          ownerId: hostId,
          make: vehicleMake,
          model: vehicleModel,
          color: vehicleColor,
          plate: vehiclePlate || undefined,
          fuelEfficiencyKmL: fuelEfficiency,
        }),
      });

      // Anchor to Philippine Standard Time explicitly rather than relying on
      // the browser's local timezone, so storage stays correct UTC (thesis
      // §5.1.4) regardless of where this form happens to be opened from.
      const departureTime = new Date(`${date}T${time}:00+08:00`).toISOString();

      await apiFetch('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          hostId,
          vehicleId: vehicle.id,
          originAddress: origin,
          originLat: originCoords.lat,
          originLng: originCoords.lng,
          destinationAddress: destination,
          destinationLat: destinationCoords.lat,
          destinationLng: destinationCoords.lng,
          departureTime,
          recurrenceType: recurrence,
          customDays: recurrence === 'CUSTOM' ? customDays : [],
          totalSeats: seats,
          fuelShareSuggested: fuelShare ? Number(fuelShare) : undefined,
          driverNotes: driverNotes || undefined,
          genderPreference,
          flexibleDeparture,
          flexWindowMinutes: 15,
          familiarRidersOnly,
          meetingPointAddress: meetingPointAddress || undefined,
          meetingPointLat: meetingCoords?.lat,
          meetingPointLng: meetingCoords?.lng,
        }),
      });

      router.push('/auth/trips');
    } catch {
      setError('Couldn’t publish that trip. Check the fields above and try again.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <div className="rsu-card space-y-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Trip Details</h2>
            <p className="text-xs text-gray-500">Basic information about your trip</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Origin</label>
            <input
              type="text"
              required
              placeholder="e.g., Lucban, Tayabas, Candelaria"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Destination</label>
            <input
              type="text"
              required
              placeholder="e.g., Enverga University, Lucena"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Date</label>
              <DatePicker
                min={getPhTodayDateString()}
                value={date}
                onChange={setDate}
                className="px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)] focus:border-[color:var(--rsu-color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Departure Time</label>
              <TimePicker
                min={date === getPhTodayDateString() ? getPhNowTimeString() : undefined}
                value={time}
                onChange={setTime}
                className="px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)] focus:border-[color:var(--rsu-color-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Recurrence</label>
            <div className="grid grid-cols-2 gap-2">
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecurrence(opt.value)}
                  className={`text-left p-3 rounded-xl border text-xs ${
                    recurrence === opt.value
                      ? 'border-[color:var(--rsu-color-primary)] bg-[color:var(--rsu-color-primary)]/5'
                      : 'border-gray-200'
                  }`}
                >
                  <p className="font-semibold text-gray-900">{opt.label}</p>
                  <p className="text-gray-500 mt-0.5">{opt.hint}</p>
                </button>
              ))}
            </div>
            {recurrence === 'CUSTOM' && (
              <div className="flex gap-1.5 mt-3">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleCustomDay(i)}
                    className={`w-9 h-9 rounded-full text-xs font-semibold border ${
                      customDays.includes(i)
                        ? 'bg-[color:var(--rsu-color-primary)] text-white border-[color:var(--rsu-color-primary)]'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {label.charAt(0)}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-2">
              Passengers who match your trip will be joined for all selected days automatically.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Available Seats</label>
              <Listbox<number>
                value={seats}
                onChange={setSeats}
                options={SEAT_OPTIONS}
                ariaLabel="Available seats"
                className="pl-3 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Fuel Share Contribution
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g., 50"
                  value={fuelShare}
                  onChange={(e) => setFuelShare(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Suggested amount per passenger (PHP)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Vehicle Make</label>
              <input
                type="text"
                required
                placeholder="Toyota"
                value={vehicleMake}
                onChange={(e) => setVehicleMake(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Model</label>
              <input
                type="text"
                required
                placeholder="Vios"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Color</label>
              <input
                type="text"
                required
                placeholder="White"
                value={vehicleColor}
                onChange={(e) => setVehicleColor(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Plate Number</label>
              <input
                type="text"
                placeholder="ABC 1234"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 -mt-2">
            Only shared with the host or riders you've approved — never shown in public search results.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Fuel Efficiency (km/L)
            </label>
            <input
              type="number"
              required
              min="1"
              step="0.1"
              placeholder="e.g., 14"
              value={fuelEfficiency}
              onChange={(e) => setFuelEfficiency(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">Used to estimate each passenger's fuel share automatically.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Driver Notes</label>
            <textarea
              rows={3}
              placeholder="e.g., Please bring exact cash or GCash. I drop my kid off at school first before heading to campus."
              value={driverNotes}
              onChange={(e) => setDriverNotes(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">Optional — share anything passengers should know before joining</p>
          </div>
        </div>

        <div className="rsu-card space-y-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Preferences</h2>
            <p className="text-xs text-gray-500">Set your co-rider preferences</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Co-rider Gender Preference
            </label>
            <Listbox<'ANY' | 'SAME_GENDER'>
              value={genderPreference}
              onChange={setGenderPreference}
              options={GENDER_PREFERENCE_OPTIONS}
              ariaLabel="Co-rider gender preference"
              className="pl-3 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Flexible Departure Time</p>
              <p className="text-xs text-gray-500">Allow ±15 minutes from scheduled time</p>
            </div>
            <input
              type="checkbox"
              checked={flexibleDeparture}
              onChange={(e) => setFlexibleDeparture(e.target.checked)}
              className="w-5 h-5 accent-[color:var(--rsu-color-primary)]"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Familiar Riders Only</p>
              <p className="text-xs text-gray-500">Only accept riders you've traveled with before</p>
            </div>
            <input
              type="checkbox"
              checked={familiarRidersOnly}
              onChange={(e) => setFamiliarRidersOnly(e.target.checked)}
              className="w-5 h-5 accent-[color:var(--rsu-color-primary)]"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rsu-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting && <FaSpinner className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Posting...' : 'Publish Trip'}
          </button>
          <button type="button" onClick={() => router.push('/auth/dashboard')} className="rsu-btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </div>

      <div className="md:sticky md:top-20 h-fit space-y-4">
        <div className="rsu-card">
          <h2 className="text-sm font-bold text-gray-900">Set Meeting Point</h2>
          <p className="text-xs text-gray-500 mb-3">Choose where passengers will meet you</p>

          {originCoords && destinationCoords ? (
            <>
              <RouteMap origin={originCoords} destination={destinationCoords} />
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Meeting Point (optional)
                </label>
                <input
                  type="text"
                  placeholder="Defaults to your origin if left blank"
                  value={meetingPointAddress}
                  onChange={(e) => setMeetingPointAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none"
                />
              </div>
            </>
          ) : (
            <div className="w-full h-48 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center text-center px-6">
              <p className="text-xs text-gray-400">Enter origin and destination to view route and set meeting point</p>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

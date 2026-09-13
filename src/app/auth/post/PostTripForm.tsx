'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaSpinner } from 'react-icons/fa';
import RouteMap from '@/components/RouteMap';
import Listbox from '@/components/Listbox';
import DatePicker from '@/components/DatePicker';
import TimePicker from '@/components/TimePicker';
import { apiFetch, ApiError } from '@/lib/api';
import { getPhTodayDateString, getPhNowTimeString, phInputDate, phInputTime } from '@/lib/format';
import { fetchRoute, type FetchedRoute } from '@/lib/directions';
import { FUEL_PRICE_PER_LITER, MIN_FUEL_PRICE_PER_LITER, MAX_FUEL_PRICE_PER_LITER } from '@/lib/constants';
import ConfirmStructuralEditModal from '@/components/ConfirmStructuralEditModal';
import { useCurrentLocationAddress } from '@/lib/useCurrentLocationAddress';

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

export interface EditableTrip {
  id: string;
  originAddress: string;
  originLat: number;
  originLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  routeWaypoints: Coords[] | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  departureTime: string;
  recurrenceType: Recurrence;
  customDays: number[];
  totalSeats: number;
  filledSeats: number;
  approvedCount: number;
  fuelSharePerSeat: number | null;
  driverNotes: string | null;
  genderPreference: 'ANY' | 'SAME_GENDER';
  flexibleDeparture: boolean;
  flexWindowMinutes: number;
  familiarRidersOnly: boolean;
  meetingPointAddress: string | null;
  meetingPointLat: number | null;
  meetingPointLng: number | null;
  vehicle: { make: string; model: string; color: string; plate: string | null; fuelEfficiencyKmL: number };
}

function useGeocodedAddress(query: string, initial: Coords | null = null) {
  const [coords, setCoords] = useState<Coords | null>(initial);
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

export default function PostTripForm({ hostId, editTrip }: { hostId: string; editTrip?: EditableTrip }) {
  const router = useRouter();
  const isEdit = Boolean(editTrip);

  const [origin, setOrigin] = useState(editTrip?.originAddress ?? '');
  const {
    resolving: locatingOrigin,
    error: originLocationError,
    resolve: resolveCurrentLocation,
  } = useCurrentLocationAddress();
  async function useMyCurrentLocation() {
    const address = await resolveCurrentLocation();
    // Sets the same text state manual typing would — useGeocodedAddress below
    // then forward-geocodes it into coordinates exactly like any typed
    // address, since that's the only mechanism either path has for setting
    // origin's coordinates.
    if (address) setOrigin(address);
  }
  const [destination, setDestination] = useState(editTrip?.destinationAddress ?? 'Enverga University, Lucena City');
  const [date, setDate] = useState(editTrip ? phInputDate(editTrip.departureTime) : '');
  const [time, setTime] = useState(editTrip ? phInputTime(editTrip.departureTime) : '07:00');
  const [recurrence, setRecurrence] = useState<Recurrence>(editTrip?.recurrenceType ?? 'ONE_TIME');
  const [customDays, setCustomDays] = useState<number[]>(editTrip?.customDays ?? []);
  const [seats, setSeats] = useState(editTrip?.totalSeats ?? 1);
  // Create-only (fuelPricePerLiter isn't in EDITABLE_TRIP_FIELDS — a host's
  // entered price is frozen alongside fuelSharePerSeat once posted, same as
  // the rest of that computation). Pre-filled with the same default the old
  // hardcoded constant used, fully editable to today's actual price.
  // Kept as a raw string (matching fuelEfficiency below) — coercing straight
  // to a number on every keystroke turns a cleared field into 0 instead of
  // empty, so typing "85" after clearing produces "085".
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState(String(FUEL_PRICE_PER_LITER));
  const [vehicleMake, setVehicleMake] = useState(editTrip?.vehicle.make ?? '');
  const [vehicleModel, setVehicleModel] = useState(editTrip?.vehicle.model ?? '');
  const [vehicleColor, setVehicleColor] = useState(editTrip?.vehicle.color ?? '');
  const [vehiclePlate, setVehiclePlate] = useState(editTrip?.vehicle.plate ?? '');
  const [fuelEfficiency, setFuelEfficiency] = useState(
    editTrip ? String(editTrip.vehicle.fuelEfficiencyKmL) : ''
  );
  const [driverNotes, setDriverNotes] = useState(editTrip?.driverNotes ?? '');
  const [genderPreference, setGenderPreference] = useState<'ANY' | 'SAME_GENDER'>(editTrip?.genderPreference ?? 'ANY');
  const [flexibleDeparture, setFlexibleDeparture] = useState(editTrip?.flexibleDeparture ?? false);
  const [familiarRidersOnly, setFamiliarRidersOnly] = useState(editTrip?.familiarRidersOnly ?? false);
  const [meetingPointAddress, setMeetingPointAddress] = useState(editTrip?.meetingPointAddress ?? '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Server's CONFIRMATION_REQUIRED payload, shown in the modal before a second submit.
  const [confirmData, setConfirmData] = useState<{
    changeSummary: string;
    approvedCount: number;
    fuelShareWouldChange: { from: number; to: number } | null;
  } | null>(null);
  // `disabled={isSubmitting}` alone has a real gap: a second click fired
  // before React re-renders with the disabled button reads `isSubmitting`
  // from the same stale closure as the first, since state updates aren't
  // synchronous. A ref updates immediately, so this is the actual guard;
  // the state is just what drives the visible disabled/spinner UI.
  const isSubmittingRef = useRef(false);

  const { coords: originCoords } = useGeocodedAddress(
    origin,
    editTrip ? { lat: editTrip.originLat, lng: editTrip.originLng } : null
  );
  const { coords: destinationCoords } = useGeocodedAddress(
    destination,
    editTrip ? { lat: editTrip.destinationLat, lng: editTrip.destinationLng } : null
  );
  const { coords: meetingCoords } = useGeocodedAddress(
    meetingPointAddress,
    editTrip && editTrip.meetingPointLat != null && editTrip.meetingPointLng != null
      ? { lat: editTrip.meetingPointLat, lng: editTrip.meetingPointLng }
      : null
  );

  // Fetch the road route once both ends resolve. The result feeds the map
  // preview AND is sent with the trip so the server can persist distance +
  // duration (after a sanity check) — trip-completion timing and the fuel-share
  // estimate both read those. Re-fetched only when an endpoint actually moves.
  const [route, setRoute] = useState<FetchedRoute | null>(
    editTrip?.routeWaypoints && editTrip.distanceMeters != null && editTrip.durationSeconds != null
      ? {
          waypoints: editTrip.routeWaypoints,
          distanceMeters: editTrip.distanceMeters,
          durationSeconds: editTrip.durationSeconds,
        }
      : null
  );
  useEffect(() => {
    if (!originCoords || !destinationCoords) {
      if (!isEdit) setRoute(null);
      return;
    }
    let cancelled = false;
    fetchRoute(originCoords, destinationCoords).then((r) => {
      if (cancelled) return;
      // In edit mode a failed re-fetch keeps the trip's stored route rather than
      // wiping it (which would look like the host cleared the route).
      if (r || !isEdit) setRoute(r);
    });
    return () => {
      cancelled = true;
    };
  }, [originCoords?.lat, originCoords?.lng, destinationCoords?.lat, destinationCoords?.lng]);

  // Parsed only where the numeric value is actually needed (bounds check,
  // preview math, submit payload) — null while empty or unparseable, not 0,
  // so an in-progress edit (cleared field, "62." mid-type) doesn't read as
  // "below the minimum."
  const fuelPriceValue = fuelPricePerLiter.trim() === '' ? null : Number(fuelPricePerLiter);
  const fuelPriceIsValidNumber = fuelPriceValue != null && Number.isFinite(fuelPriceValue);

  // Sanity-bound the host's typed price — an obvious typo (an extra digit)
  // would otherwise produce a wildly wrong fuel-share figure shown to
  // passengers. Server-enforced too (tripController.js); this is just the
  // immediate inline feedback before submit. Only fires once there's an
  // actual out-of-range number — an empty/in-progress field isn't "invalid,"
  // it's just incomplete, and is instead caught at submit time below.
  const fuelPriceError =
    !isEdit && fuelPriceIsValidNumber && (fuelPriceValue < MIN_FUEL_PRICE_PER_LITER || fuelPriceValue > MAX_FUEL_PRICE_PER_LITER)
      ? `Enter a price between ₱${MIN_FUEL_PRICE_PER_LITER} and ₱${MAX_FUEL_PRICE_PER_LITER} per liter.`
      : null;

  // Preview of the fixed per-seat fuel share. The server computes and persists
  // the authoritative value at posting time (from the same formula); this is a
  // display-only "≈" so the host sees roughly what riders will be asked to
  // chip in. Driver excluded — divided by seats offered.
  const efficiencyNum = Number(fuelEfficiency);
  // Once a passenger is approved the price is locked — show the stored value,
  // not a live recompute that would mislead the host into thinking it moved.
  const fuelShareLocked = isEdit && (editTrip?.approvedCount ?? 0) > 0;
  const fuelSharePreview = fuelShareLocked
    ? editTrip?.fuelSharePerSeat ?? null
    : route?.distanceMeters && efficiencyNum > 0 && seats > 0 && fuelPriceValue
      ? ((route.distanceMeters / 1000 / efficiencyNum) * fuelPriceValue) / seats
      : null;

  const seatOptions = editTrip
    ? SEAT_OPTIONS.filter((o) => o.value >= editTrip.filledSeats)
    : SEAT_OPTIONS;

  function toggleCustomDay(day: number) {
    setCustomDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitTrip(false);
  }

  async function submitTrip(confirmStructural: boolean) {
    if (isSubmittingRef.current) return;
    setError(null);

    if (!originCoords || !destinationCoords) {
      setError('Enter an origin and destination we can find on the map before saving.');
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
    // Empty is caught here rather than disabling the submit button live — an
    // in-progress edit (cleared field, about to type) shouldn't look like an
    // error before the host has even finished. Out-of-range already blocks
    // the button (fuelPriceError); this re-check is defense in depth for the
    // same reason the departure-time one above exists.
    if (!isEdit && !fuelPriceIsValidNumber) {
      setError('Enter today’s fuel price before posting.');
      return;
    }
    if (!isEdit && fuelPriceError) {
      setError(fuelPriceError);
      return;
    }

    // Anchor to Philippine Standard Time explicitly rather than relying on the
    // browser's local timezone (thesis §5.1.4).
    const departureTime = new Date(`${date}T${time}:00+08:00`).toISOString();

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (isEdit && editTrip) {
        // Only send origin/destination (and the derived route) when the address
        // text actually changed — otherwise geocoder drift on re-lookup would
        // register as a route edit the host never made.
        const originChanged = origin !== editTrip.originAddress;
        const destChanged = destination !== editTrip.destinationAddress;
        const routeChanged = originChanged || destChanged;
        const meetingChanged = meetingPointAddress !== (editTrip.meetingPointAddress ?? '');

        await apiFetch(`/api/trips/${editTrip.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            userId: hostId,
            confirmStructural,
            ...(originChanged
              ? { originAddress: origin, originLat: originCoords.lat, originLng: originCoords.lng }
              : {}),
            ...(destChanged
              ? {
                  destinationAddress: destination,
                  destinationLat: destinationCoords.lat,
                  destinationLng: destinationCoords.lng,
                }
              : {}),
            ...(routeChanged
              ? {
                  routeWaypoints: route?.waypoints ?? null,
                  distanceMeters: route?.distanceMeters ?? null,
                  durationSeconds: route?.durationSeconds ?? null,
                }
              : {}),
            departureTime,
            recurrenceType: recurrence,
            customDays: recurrence === 'CUSTOM' ? customDays : [],
            totalSeats: seats,
            driverNotes: driverNotes || null,
            genderPreference,
            flexibleDeparture,
            flexWindowMinutes: 15,
            familiarRidersOnly,
            ...(meetingChanged
              ? {
                  meetingPointAddress: meetingPointAddress || null,
                  meetingPointLat: meetingCoords?.lat ?? null,
                  meetingPointLng: meetingCoords?.lng ?? null,
                }
              : {}),
            vehicle: {
              make: vehicleMake,
              model: vehicleModel,
              color: vehicleColor,
              plate: vehiclePlate || null,
              fuelEfficiencyKmL: Number(fuelEfficiency),
            },
          }),
        });
        setConfirmData(null);
        router.push(`/auth/trips/${editTrip.id}`);
        return;
      }

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
          fuelPricePerLiter: fuelPriceValue,
          driverNotes: driverNotes || undefined,
          genderPreference,
          flexibleDeparture,
          flexWindowMinutes: 15,
          familiarRidersOnly,
          meetingPointAddress: meetingPointAddress || undefined,
          meetingPointLat: meetingCoords?.lat,
          meetingPointLng: meetingCoords?.lng,
          routeWaypoints: route?.waypoints,
          distanceMeters: route?.distanceMeters,
          durationSeconds: route?.durationSeconds,
        }),
      });

      router.push('/auth/trips');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFIRMATION_REQUIRED') {
        setConfirmData({
          changeSummary: String(err.body?.changeSummary ?? 'this trip'),
          approvedCount: Number(err.body?.approvedCount ?? 0),
          fuelShareWouldChange:
            (err.body?.fuelShareWouldChange as { from: number; to: number } | null) ?? null,
        });
      } else if (err instanceof ApiError && err.code === 'SEAT_COUNT_BELOW_FILLED') {
        const n = err.body?.filledSeats;
        setError(`This trip has ${n} confirmed passenger${n === 1 ? '' : 's'}. Decline a passenger before reducing seats below ${n}.`);
      } else if (err instanceof ApiError && err.code === 'TRIP_NOT_EDITABLE') {
        setError('This trip can no longer be edited.');
      } else {
        setError(isEdit ? 'Couldn’t save those changes. Try again in a moment.' : 'Couldn’t publish that trip. Check the fields above and try again.');
      }
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Origin</label>
              <button
                type="button"
                onClick={useMyCurrentLocation}
                disabled={locatingOrigin}
                className="text-xs font-semibold text-[color:var(--rsu-color-primary)] hover:underline disabled:opacity-50"
              >
                {locatingOrigin ? 'Locating...' : 'Use my current location'}
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="e.g., Lucban, Tayabas, Candelaria"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
            />
            {originLocationError && <p className="text-xs text-red-600 mt-1">{originLocationError}</p>}
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
                options={seatOptions}
                ariaLabel="Available seats"
                className="pl-3 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm"
              />
              {editTrip && editTrip.filledSeats > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Can’t go below {editTrip.filledSeats} — that many seats are filled. Decline a passenger first.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Voluntary Fuel Share
              </label>
              <div className="px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-700">
                {fuelSharePreview != null ? `${fuelShareLocked ? '' : '≈ '}₱${fuelSharePreview.toFixed(2)}` : '—'}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {fuelShareLocked
                  ? 'Locked — passengers have matched. Editing the vehicle or seats won’t change this.'
                  : 'Per seat — set from route, mileage & fuel price. Fixed once you post.'}
              </p>
            </div>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Current Fuel Price (₱/liter)
              </label>
              <input
                type="number"
                step="0.01"
                min={MIN_FUEL_PRICE_PER_LITER}
                max={MAX_FUEL_PRICE_PER_LITER}
                placeholder={`e.g., ${FUEL_PRICE_PER_LITER}`}
                value={fuelPricePerLiter}
                onChange={(e) => setFuelPricePerLiter(e.target.value)}
                className="rsu-input-no-spinner w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Today's pump price — used to compute the fuel share above. No live price feed, so enter it yourself.
              </p>
              {fuelPriceError && <p className="text-xs text-red-600 mt-1">{fuelPriceError}</p>}
            </div>
          )}

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
            disabled={isSubmitting || Boolean(fuelPriceError)}
            className="rsu-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting && <FaSpinner className="w-4 h-4 animate-spin" />}
            {isSubmitting ? (isEdit ? 'Saving...' : 'Posting...') : isEdit ? 'Save Changes' : 'Publish Trip'}
          </button>
          <button
            type="button"
            onClick={() => router.push(isEdit && editTrip ? `/auth/trips/${editTrip.id}` : '/auth/dashboard')}
            className="rsu-btn-secondary flex-1"
          >
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
              <RouteMap
                origin={originCoords}
                destination={destinationCoords}
                meetingPoint={meetingCoords}
                routeWaypoints={route?.waypoints}
              />
              {route && (
                <p className="mt-2 text-xs text-gray-500">
                  {(route.distanceMeters / 1000).toFixed(1)} km · about {Math.round(route.durationSeconds / 60)} min drive
                </p>
              )}
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

      {confirmData && (
        <ConfirmStructuralEditModal
          changeSummary={confirmData.changeSummary}
          approvedCount={confirmData.approvedCount}
          fuelShareWouldChange={confirmData.fuelShareWouldChange}
          loading={isSubmitting}
          onClose={() => setConfirmData(null)}
          onConfirm={() => submitTrip(true)}
        />
      )}
    </form>
  );
}

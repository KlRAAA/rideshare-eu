'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaSpinner } from 'react-icons/fa';
import RouteMap from '@/components/RouteMap';
import Listbox from '@/components/Listbox';
import DatePicker from '@/components/DatePicker';
import TimePicker from '@/components/TimePicker';
import { apiFetch, ApiError } from '@/lib/api';
import { conflictMessage } from '@/lib/modeNav';
import { getPhTodayDateString, getPhNowTimeString, phInputDate, phInputTime } from '@/lib/format';
import { fetchRoute, type FetchedRoute } from '@/lib/directions';
import { FUEL_PRICE_PER_LITER, MIN_FUEL_PRICE_PER_LITER, MAX_FUEL_PRICE_PER_LITER } from '@/lib/constants';
import ConfirmStructuralEditModal from '@/components/ConfirmStructuralEditModal';
import VehicleFields from '@/components/VehicleFields';
import { EMPTY_VEHICLE_FIELDS, toVehiclePayload, vehicleFieldProblem, type VehicleFieldValues } from '@/lib/vehicles';
import { flagField } from '@/lib/fieldError';
import { DEFAULT_FUEL_TYPE, FUEL_TYPE_SHORT_LABELS, isFuelType, type FuelType, type OfficialFuelPrices } from '@/lib/fuelTypes';
import VehicleSection from './VehicleSection';
import { useGeocodedAddress, reverseGeocodeLabel } from '@/lib/useGeocodedAddress';
import AddressInput from '@/components/AddressInput';
import { useFormDraft } from '@/lib/useFormDraft';
import DraftRestoredBar from '@/components/DraftRestoredBar';
import { useCurrentLocationAddress } from '@/lib/useCurrentLocationAddress';
import { WHO_CAN_JOIN_OPTIONS, type GenderPreference } from '@/lib/riderRules';

// A car's back seat, not a van (adviser): the server caps it at 4 too.
const SEAT_OPTIONS = [1, 2, 3, 4].map((n) => ({ value: n, label: `${n} seat${n > 1 ? 's' : ''}` }));

type Recurrence = 'ONE_TIME' | 'DAILY' | 'WEEKDAYS' | 'CUSTOM';

interface Coords {
  lat: number;
  lng: number;
}

// Server-side INVALID_TRIP field → what the host should fix.
const INVALID_TRIP_MESSAGES: Record<string, string> = {
  originAddress: 'Enter where you’re leaving from.',
  destinationAddress: 'Enter where you’re going.',
  originLat: 'We couldn’t place your origin on the map. Adjust the address or drag the pin.',
  originLng: 'We couldn’t place your origin on the map. Adjust the address or drag the pin.',
  destinationLat: 'We couldn’t place your destination on the map. Check the address.',
  destinationLng: 'We couldn’t place your destination on the map. Check the address.',
  departureTime: 'Pick a departure date and time in the future.',
  customDays: 'Pick at least one day for a custom schedule.',
  totalSeats: 'Offer between 1 and 4 seats.',
  driverNotes: 'Keep driver notes under 500 characters.',
  meetingPointLat: 'Set the meeting point again on the map.',
  meetingPointLng: 'Set the meeting point again on the map.',
  origin: 'Your starting point must be in Luzon. Pick a place in Luzon.',
  destination: 'Your destination must be in Luzon. Pick a place in Luzon.',
  meetingPoint: 'The meeting point must be in Luzon. Move it to a place in Luzon.',
};

// The form field each INVALID_TRIP `field` points at, so the error shows on it.
const INVALID_TRIP_FIELD_IDS: Record<string, string> = {
  originAddress: 'trip-origin',
  originLat: 'trip-origin',
  originLng: 'trip-origin',
  origin: 'trip-origin',
  destinationAddress: 'trip-destination',
  destinationLat: 'trip-destination',
  destinationLng: 'trip-destination',
  destination: 'trip-destination',
  departureTime: 'trip-date',
  driverNotes: 'trip-notes',
  meetingPointLat: 'trip-meeting-point',
  meetingPointLng: 'trip-meeting-point',
  meetingPoint: 'trip-meeting-point',
};

function samePoint(a: Coords | null, b: Coords | null): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;
}

const RECURRENCE_OPTIONS: { value: Recurrence; label: string; hint: string }[] = [
  { value: 'ONE_TIME', label: 'Once', hint: 'Just this day.' },
  { value: 'DAILY', label: 'Daily', hint: 'Every day, weekends too.' },
  { value: 'WEEKDAYS', label: 'Weekdays', hint: 'Monday to Friday, every week.' },
  { value: 'CUSTOM', label: 'Custom', hint: 'The days you pick, every week.' },
];

// Sentence-case labels and one field style for the whole form.
const LABEL = 'mb-1 block text-sm font-medium text-gray-700';
const FIELD = 'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]';
const NOTE = 'mt-1 text-xs text-gray-500';
const SECTION = 'rsu-card flex flex-col gap-4';
const SECTION_TITLE = 'text-base font-semibold text-gray-900';

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
  genderPreference: GenderPreference;
  flexibleDeparture: boolean;
  flexWindowMinutes: number;
  familiarRidersOnly: boolean;
  meetingPointAddress: string | null;
  meetingPointLat: number | null;
  meetingPointLng: number | null;
  vehicle: { make: string; model: string; color: string; plate: string | null; fuelEfficiencyKmL: number; fuelType: FuelType };
}

interface PostTripFormProps {
  hostId: string;
  editTrip?: EditableTrip;
  // Only women and non-binary hosts may offer Women+ trips (Women+ spec D5).
  canHostWomenPlus: boolean;
}

export default function PostTripForm({ hostId, editTrip, canHostWomenPlus }: PostTripFormProps) {
  const router = useRouter();
  const isEdit = Boolean(editTrip);

  const [origin, setOrigin] = useState(editTrip?.originAddress ?? '');
  const {
    resolving: locatingOrigin,
    error: originLocationError,
    resolve: resolveCurrentLocation,
  } = useCurrentLocationAddress();
  async function useMyCurrentLocation() {
    const result = await resolveCurrentLocation();
    if (!result) return;
    setOrigin(result.address);
    // The device's own fix is more precise than re-geocoding its address text.
    setOriginPin(result.coords);
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
  // Admin-set caps, one per fuel type (GET /api/fuel-price). The car's own
  // type picks which one pre-fills the field and caps it; the host may go
  // lower, never higher.
  const [officialFuelPrices, setOfficialFuelPrices] = useState<Partial<Record<FuelType, number | null>>>({});
  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    apiFetch<{ prices: OfficialFuelPrices }>('/api/fuel-price')
      .then(({ prices }) => {
        if (cancelled) return;
        setOfficialFuelPrices(
          Object.fromEntries(Object.entries(prices).map(([type, p]) => [type, p ? p.pricePerLiter : null]))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isEdit]);
  const [vehicle, setVehicle] = useState<VehicleFieldValues>(
    editTrip
      ? {
          make: editTrip.vehicle.make,
          model: editTrip.vehicle.model,
          color: editTrip.vehicle.color,
          plate: editTrip.vehicle.plate ?? '',
          fuelEfficiency: String(editTrip.vehicle.fuelEfficiencyKmL),
          fuelType: editTrip.vehicle.fuelType ?? DEFAULT_FUEL_TYPE,
        }
      : EMPTY_VEHICLE_FIELDS
  );
  // Drafts saved before cars had a fuel type restore without one.
  const carFuelType: FuelType = isFuelType(vehicle.fuelType) ? vehicle.fuelType : DEFAULT_FUEL_TYPE;
  const officialFuelPrice = officialFuelPrices[carFuelType] ?? null;
  // The last price this form filled in by itself. While the field still holds
  // it (or the untouched default), switching to a car with another fuel type
  // swaps in that type's official price; a price the host typed, or one
  // restored from a draft, is never replaced.
  const autoFilledPrice = useRef<string | null>(null);
  useEffect(() => {
    if (isEdit || officialFuelPrice == null) return;
    const next = String(officialFuelPrice);
    setFuelPricePerLiter((prev) => {
      if (prev !== String(FUEL_PRICE_PER_LITER) && prev !== autoFilledPrice.current) return prev;
      autoFilledPrice.current = next;
      return next;
    });
  }, [isEdit, officialFuelPrice]);
  const [saveNewCar, setSaveNewCar] = useState(false);
  const [driverNotes, setDriverNotes] = useState(editTrip?.driverNotes ?? '');
  const [genderPreference, setGenderPreference] = useState<GenderPreference>(editTrip?.genderPreference ?? 'ANY');
  const [flexibleDeparture, setFlexibleDeparture] = useState(editTrip?.flexibleDeparture ?? false);
  const [familiarRidersOnly, setFamiliarRidersOnly] = useState(editTrip?.familiarRidersOnly ?? false);
  const [meetingPointAddress, setMeetingPointAddress] = useState(editTrip?.meetingPointAddress ?? '');
  // When editing, start from the trip's stored spots so re-geocoding the same
  // text can't drift them.
  const savedOrigin = editTrip ? { lat: editTrip.originLat, lng: editTrip.originLng } : null;
  const savedDestination = editTrip ? { lat: editTrip.destinationLat, lng: editTrip.destinationLng } : null;
  const savedMeeting =
    editTrip && editTrip.meetingPointLat != null && editTrip.meetingPointLng != null
      ? { lat: editTrip.meetingPointLat, lng: editTrip.meetingPointLng }
      : null;
  const [originPin, setOriginPin] = useState<Coords | null>(savedOrigin);
  const [meetingPin, setMeetingPin] = useState<Coords | null>(savedMeeting);
  const [destinationPin, setDestinationPin] = useState<Coords | null>(savedDestination);
  // Typed text that wasn't picked from the suggestions is looked up once the
  // field is left (Nominatim forbids lookups on every keystroke). A picked
  // suggestion sets the matching pin instead, so no lookup is needed.
  const [originLookup, setOriginLookup] = useState('');
  const [destinationLookup, setDestinationLookup] = useState(editTrip ? '' : 'Enverga University, Lucena City');
  const [meetingLookup, setMeetingLookup] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 409 RATING_REQUIRED: the last trip, whose riders the driver rates first.
  const [rateTripId, setRateTripId] = useState<string | null>(null);
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

  const { coords: geocodedOrigin, resolving: resolvingOrigin } = useGeocodedAddress(originPin ? '' : originLookup);
  const { coords: geocodedDestination, resolving: resolvingDestination } = useGeocodedAddress(destinationPin ? '' : destinationLookup);
  const { coords: geocodedMeeting, resolving: resolvingMeeting } = useGeocodedAddress(meetingPin ? '' : meetingLookup);
  // A picked suggestion, a pin set on the map or the device's location beats
  // the approximate lookup of typed text; typing a new address clears it.
  const originCoords = originPin ?? geocodedOrigin;
  const destinationCoords = destinationPin ?? geocodedDestination;
  const meetingCoords = meetingPin ?? geocodedMeeting;

  async function placeMeetingPin(point: Coords) {
    setMeetingPin(point);
    if (!meetingPointAddress.trim()) {
      setMeetingPointAddress((await reverseGeocodeLabel(point)) ?? 'Pinned on the map');
    }
  }

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
      : !isEdit && fuelPriceIsValidNumber && officialFuelPrice != null && fuelPriceValue > officialFuelPrice
        ? `The official ${FUEL_TYPE_SHORT_LABELS[carFuelType]} price is ₱${officialFuelPrice.toFixed(2)}/L. You can enter less, not more.`
        : null;

  // Preview of the fixed per-seat fuel share. The server computes and persists
  // the authoritative value at posting time (from the same formula); this is a
  // display-only "≈" so the host sees roughly what riders will be asked to
  // chip in. Driver excluded — divided by seats offered.
  const efficiencyNum = Number(vehicle.fuelEfficiency);
  // Once a passenger is approved the price is locked — show the stored value,
  // not a live recompute that would mislead the host into thinking it moved.
  const fuelShareLocked = isEdit && (editTrip?.approvedCount ?? 0) > 0;
  // Riders agreed to the trip as it was, so the rule locks once one is approved (D3).
  const whoCanJoinLocked = fuelShareLocked;
  const whoCanJoinOptions = WHO_CAN_JOIN_OPTIONS.filter(
    (o) => o.value === 'ANY' || canHostWomenPlus || editTrip?.genderPreference === 'WOMEN_PLUS'
  );
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
    setRateTripId(null);
    // The message at the bottom of the form, and the same message on the field.
    const fail = (message: string, fieldId?: string) => {
      setError(message);
      if (fieldId) flagField(fieldId, message);
    };

    if (!originCoords) {
      fail('Enter where you’re leaving from: pick a suggestion or a place on the map.', 'trip-origin');
      return;
    }
    if (!destinationCoords) {
      fail('Enter where you’re going: pick a suggestion or a place on the map.', 'trip-destination');
      return;
    }
    if (!date) {
      fail('Date is required.', 'trip-date');
      return;
    }
    if (!time) {
      fail('Departure time is required.', 'trip-time');
      return;
    }
    // Defense in depth alongside the date/time fields' `min` attributes —
    // those can still be bypassed (typed manually, or time simply elapsing
    // between page load and submit), so re-check here in the same PH-anchored
    // way the actual departureTime below is computed.
    if (new Date(`${date}T${time}:00+08:00`) < new Date()) {
      fail('That departure time has already passed. Pick a time in the future.', 'trip-time');
      return;
    }
    const vehicleProblem = vehicleFieldProblem(vehicle);
    if (vehicleProblem) {
      fail(vehicleProblem.message, `post-vehicle-${vehicleProblem.field}`);
      return;
    }
    // Empty is caught here rather than disabling the submit button live — an
    // in-progress edit (cleared field, about to type) shouldn't look like an
    // error before the host has even finished. Out-of-range already blocks
    // the button (fuelPriceError); this re-check is defense in depth for the
    // same reason the departure-time one above exists.
    if (!isEdit && !fuelPriceIsValidNumber) {
      fail('Enter today’s fuel price before posting.', 'trip-fuel-price');
      return;
    }
    if (!isEdit && fuelPriceError) {
      fail(fuelPriceError, 'trip-fuel-price');
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
        const originChanged = origin !== editTrip.originAddress || !samePoint(originCoords, savedOrigin);
        const destChanged = destination !== editTrip.destinationAddress || !samePoint(destinationCoords, savedDestination);
        const routeChanged = originChanged || destChanged;
        const meetingChanged =
          meetingPointAddress !== (editTrip.meetingPointAddress ?? '') || !samePoint(meetingCoords, savedMeeting);

        await apiFetch(`/api/trips/${editTrip.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
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
            vehicle: toVehiclePayload({ ...vehicle, fuelType: carFuelType }),
          }),
        });
        setConfirmData(null);
        draft.clear();
        router.replace(`/auth/trips/${editTrip.id}`); // Back skips the submitted form
        return;
      }

      const carPayload = toVehiclePayload({ ...vehicle, fuelType: carFuelType });
      // Each trip keeps its own copy of the car, so a later edit to this trip
      // never changes other trips or the saved car.
      const { vehicle: tripVehicle } = await apiFetch<{ vehicle: { id: string } }>('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify(carPayload),
      });

      await apiFetch('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: tripVehicle.id,
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

      // Best-effort: the trip is already posted, so a failed save (e.g. the
      // 5-car limit reached in another tab) must not turn this into an error.
      if (saveNewCar) {
        await apiFetch('/api/saved-vehicles', { method: 'POST', body: JSON.stringify(carPayload) }).catch(() => {});
      }

      draft.clear();
      router.replace('/auth/trips'); // Back skips the submitted form
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
      } else if (err instanceof ApiError && err.code === 'WHO_CAN_JOIN_LOCKED') {
        setError('Who can join can’t change after a rider is approved.');
      } else if (err instanceof ApiError && err.code === 'WOMEN_PLUS_HOST_NOT_ELIGIBLE') {
        setError('Only women and non-binary hosts can post Women+ trips.');
      } else if (err instanceof ApiError && err.code === 'TRIP_NOT_EDITABLE') {
        setError('This trip can no longer be edited.');
      } else if (err instanceof ApiError && err.code === 'DRIVING_NOW') {
        setError('You’re driving a trip right now. End it before you post your next trip.');
      } else if (err instanceof ApiError && err.code === 'RATING_REQUIRED') {
        const riders = Array.isArray(err.body?.riders) ? (err.body.riders as { rateeName: string }[]).map((r) => r.rateeName) : [];
        setError(`Rate the riders from your last trip first${riders.length ? `: ${riders.join(', ')}` : ''}.`);
        setRateTripId(typeof err.body?.tripId === 'string' ? err.body.tripId : null);
      } else if (err instanceof ApiError && err.code === 'SCHEDULE_CONFLICT') {
        fail(conflictMessage(String(err.body?.conflictDepartureTime)), 'trip-time');
      } else if (err instanceof ApiError && err.code === 'INVALID_TRIP') {
        const field = String(err.body?.field);
        fail(INVALID_TRIP_MESSAGES[field] ?? 'Some trip details aren’t valid. Check the fields above and try again.', INVALID_TRIP_FIELD_IDS[field]);
      } else if (err instanceof ApiError && err.code === 'FUEL_PRICE_ABOVE_OFFICIAL') {
        const cap = Number(err.body?.officialPrice);
        const type = isFuelType(err.body?.fuelType) ? err.body.fuelType : carFuelType;
        setOfficialFuelPrices((prev) => ({ ...prev, [type]: cap }));
        fail(`The official ${FUEL_TYPE_SHORT_LABELS[type]} price is now ₱${cap.toFixed(2)}/L. Lower your price and post again.`, 'trip-fuel-price');
      } else {
        setError(isEdit ? 'Couldn’t save those changes. Try again in a moment.' : 'Couldn’t publish that trip. Check the fields above and try again.');
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const draft = useFormDraft(
    editTrip ? `post-trip:edit:${editTrip.id}` : 'post-trip:new',
    {
      origin, originPin, destination, destinationPin, date, time, recurrence, customDays, seats, fuelPricePerLiter,
      vehicle, driverNotes, genderPreference, flexibleDeparture, familiarRidersOnly, meetingPointAddress, meetingPin,
    },
    {
      onRestore: (d) => {
        if (typeof d.origin === 'string') {
          setOrigin(d.origin);
          setOriginLookup(d.origin);
        }
        if (d.originPin !== undefined) setOriginPin(d.originPin);
        if (typeof d.destination === 'string') {
          setDestination(d.destination);
          setDestinationLookup(d.destination);
        }
        if (d.destinationPin !== undefined) setDestinationPin(d.destinationPin);
        if (typeof d.date === 'string') setDate(d.date);
        if (typeof d.time === 'string') setTime(d.time);
        if (d.recurrence) setRecurrence(d.recurrence);
        if (Array.isArray(d.customDays)) setCustomDays(d.customDays);
        if (typeof d.seats === 'number') setSeats(d.seats);
        if (typeof d.fuelPricePerLiter === 'string') setFuelPricePerLiter(d.fuelPricePerLiter);
        if (d.vehicle) setVehicle(d.vehicle);
        if (typeof d.driverNotes === 'string') setDriverNotes(d.driverNotes);
        if (d.genderPreference === 'WOMEN_PLUS' ? canHostWomenPlus : d.genderPreference === 'ANY') setGenderPreference(d.genderPreference);
        if (typeof d.flexibleDeparture === 'boolean') setFlexibleDeparture(d.flexibleDeparture);
        if (typeof d.familiarRidersOnly === 'boolean') setFamiliarRidersOnly(d.familiarRidersOnly);
        if (typeof d.meetingPointAddress === 'string') {
          setMeetingPointAddress(d.meetingPointAddress);
          setMeetingLookup(d.meetingPointAddress);
        }
        if (d.meetingPin !== undefined) setMeetingPin(d.meetingPin);
      },
    }
  );

  const repeat = RECURRENCE_OPTIONS.find((o) => o.value === recurrence) ?? RECURRENCE_OPTIONS[0];

  return (
    <form
      onSubmit={handleSubmit}
      onInputCapture={draft.markDirty}
      onClickCapture={draft.markDirty}
      className="mx-auto flex max-w-2xl flex-col gap-4"
    >
      {draft.restored && <DraftRestoredBar onDiscard={draft.discard} />}

      {/* Route first, with the map and meeting point right under it, so a
          phone shows the meeting point before Publish (critique, Oct 2026). */}
      <section className={SECTION}>
        <h2 className={SECTION_TITLE}>Route</h2>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="trip-origin" className="block text-sm font-medium text-gray-700">
              From
            </label>
            <button
              type="button"
              onClick={useMyCurrentLocation}
              disabled={locatingOrigin}
              className="text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline disabled:opacity-50"
            >
              {locatingOrigin ? 'Locating…' : 'Use my location'}
            </button>
          </div>
          <AddressInput
            id="trip-origin"
            busy={resolvingOrigin}
            required
            placeholder="e.g., Lucban, Tayabas, Candelaria"
            value={origin}
            onChange={(text) => {
              setOrigin(text);
              setOriginPin(null);
            }}
            onSelect={(place) => {
              setOrigin(place.label);
              setOriginPin({ lat: place.lat, lng: place.lng });
            }}
            onCommit={setOriginLookup}
            className={FIELD}
          />
          {originLocationError && <p className="mt-1 text-xs text-red-600">{originLocationError}</p>}
          {originPin && (
            <p className={NOTE}>
              Using the exact spot on the map.{' '}
              <button type="button" onClick={() => setOriginPin(null)} className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
                Use the address instead
              </button>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="trip-destination" className={LABEL}>
            To
          </label>
          <AddressInput
            id="trip-destination"
            busy={resolvingDestination}
            required
            placeholder="e.g., Enverga University, Lucena"
            value={destination}
            onChange={(text) => {
              setDestination(text);
              setDestinationPin(null);
            }}
            onSelect={(place) => {
              setDestination(place.label);
              setDestinationPin({ lat: place.lat, lng: place.lng });
            }}
            onCommit={setDestinationLookup}
            className={FIELD}
          />
        </div>

        {originCoords && destinationCoords && (
          <>
            <div>
              <RouteMap
                origin={originCoords}
                destination={destinationCoords}
                meetingPoint={meetingCoords}
                routeWaypoints={route?.waypoints}
                onOriginChange={(point) => {
                  draft.markDirty();
                  setOriginPin(point);
                }}
                onMeetingPointChange={(point) => {
                  draft.markDirty();
                  placeMeetingPin(point);
                }}
              />
              {route && (
                <p className={NOTE}>
                  {(route.distanceMeters / 1000).toFixed(1)} km · about {Math.round(route.durationSeconds / 60)} min drive
                </p>
              )}
            </div>
            <div>
              <label htmlFor="trip-meeting-point" className={LABEL}>
                Meeting point (optional)
              </label>
              <AddressInput
                id="trip-meeting-point"
                busy={resolvingMeeting}
                placeholder="Where you start, if left blank"
                value={meetingPointAddress}
                onChange={(text) => {
                  setMeetingPointAddress(text);
                  setMeetingPin(null);
                }}
                onSelect={(place) => {
                  setMeetingPointAddress(place.label);
                  setMeetingPin({ lat: place.lat, lng: place.lng });
                }}
                onCommit={setMeetingLookup}
                className={FIELD}
              />
              {meetingPin && (
                <p className={NOTE}>
                  Pinned on the map.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMeetingPin(null);
                      setMeetingPointAddress('');
                    }}
                    className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
                  >
                    Remove meeting point
                  </button>
                </p>
              )}
            </div>
          </>
        )}
      </section>

      <section className={SECTION}>
        <h2 className={SECTION_TITLE}>When</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="trip-date" className={LABEL}>
              {recurrence === 'ONE_TIME' ? 'Date' : 'Starting'}
            </label>
            <DatePicker id="trip-date" min={getPhTodayDateString()} value={date} onChange={setDate} className={FIELD} />
          </div>
          <div>
            <label htmlFor="trip-time" className={LABEL}>
              Leaves at
            </label>
            <TimePicker
              id="trip-time"
              min={date === getPhTodayDateString() ? getPhNowTimeString() : undefined}
              value={time}
              onChange={setTime}
              className={FIELD}
            />
          </div>
        </div>

        <div>
          <span id="trip-repeat-label" className={LABEL}>
            Repeats
          </span>
          {/* Two by two on a phone, so "Weekdays" fits even with large phone text. */}
          <div role="radiogroup" aria-labelledby="trip-repeat-label" className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 sm:grid-cols-4">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={recurrence === opt.value}
                onClick={() => setRecurrence(opt.value)}
                className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                  recurrence === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className={NOTE}>{repeat.hint}</p>
          {recurrence === 'CUSTOM' && (
            <div className="mt-3 flex gap-1.5">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={customDays.includes(i)}
                  aria-label={label}
                  onClick={() => toggleCustomDay(i)}
                  className={`h-9 w-9 rounded-full border text-xs font-semibold ${
                    customDays.includes(i)
                      ? 'border-[color:var(--rsu-color-primary)] bg-[color:var(--rsu-color-primary)] text-white'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {label.charAt(0)}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={SECTION}>
        <h2 className={SECTION_TITLE}>Car and seats</h2>
        {isEdit ? (
          <VehicleFields value={vehicle} onChange={setVehicle} idPrefix="edit-vehicle" />
        ) : (
          <VehicleSection value={vehicle} onChange={setVehicle} onSaveNewCarChange={setSaveNewCar} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={LABEL}>Seats for riders</span>
            <Listbox<number>
              value={seats}
              onChange={setSeats}
              options={seatOptions}
              ariaLabel="Seats for riders"
              className="rounded-xl border border-gray-300 bg-gray-50 py-2.5 pl-3 pr-3 text-sm"
            />
            {editTrip && editTrip.filledSeats > 0 && (
              <p className={NOTE}>At least {editTrip.filledSeats}: that many are taken.</p>
            )}
          </div>
          {!isEdit && (
            <div>
              <label htmlFor="trip-fuel-price" className={LABEL}>
                Fuel price (₱/L)
              </label>
              <input
                id="trip-fuel-price"
                type="number"
                step="0.01"
                min={MIN_FUEL_PRICE_PER_LITER}
                max={MAX_FUEL_PRICE_PER_LITER}
                placeholder={`e.g., ${FUEL_PRICE_PER_LITER}`}
                value={fuelPricePerLiter}
                onChange={(e) => setFuelPricePerLiter(e.target.value)}
                className={`rsu-input-no-spinner ${FIELD}`}
              />
            </div>
          )}
        </div>
        {!isEdit && (
          <p className="-mt-2 text-xs text-gray-500">
            {officialFuelPrice != null
              ? `Official ${FUEL_TYPE_SHORT_LABELS[carFuelType]} price ₱${officialFuelPrice.toFixed(2)}/L. You can enter less, not more.`
              : 'Today’s pump price. It sets the fuel share below.'}
          </p>
        )}
        {fuelPriceError && <p className="-mt-2 text-xs text-red-600">{fuelPriceError}</p>}

        <div className="flex items-baseline justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
          <span className="text-sm text-gray-700">Fuel share per seat</span>
          <span className="font-semibold tabular-nums text-gray-900">
            {fuelSharePreview != null ? `${fuelShareLocked ? '' : '≈ '}₱${fuelSharePreview.toFixed(2)}` : '—'}
          </span>
        </div>
        <p className="-mt-2 text-xs text-gray-500">
          {fuelShareLocked ? 'Locked: riders have joined at this share.' : 'From your route, car and fuel price. Fixed once you post.'}
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={SECTION_TITLE}>Riders</h2>
        {/* Only Women+ hosts have a choice here; for everyone else it's always "Anyone". */}
        {whoCanJoinOptions.length > 1 && (
          <div>
            <span className={LABEL}>Who can join</span>
            <Listbox<GenderPreference>
              value={genderPreference}
              onChange={setGenderPreference}
              options={whoCanJoinOptions}
              ariaLabel="Who can join"
              disabled={whoCanJoinLocked}
              className="rounded-xl border border-gray-300 bg-gray-50 py-2.5 pl-3 pr-3 text-sm"
            />
            {whoCanJoinLocked && <p className={NOTE}>Locked because riders are already approved.</p>}
          </div>
        )}

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-800">Flexible time (±15 min)</span>
          <input
            type="checkbox"
            checked={flexibleDeparture}
            onChange={(e) => setFlexibleDeparture(e.target.checked)}
            className="h-5 w-5 accent-[color:var(--rsu-color-primary)]"
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-800">Only riders I’ve ridden with</span>
          <input
            type="checkbox"
            checked={familiarRidersOnly}
            onChange={(e) => setFamiliarRidersOnly(e.target.checked)}
            className="h-5 w-5 accent-[color:var(--rsu-color-primary)]"
          />
        </label>

        <div>
          <label htmlFor="trip-notes" className={LABEL}>
            Notes for riders (optional)
          </label>
          <textarea
            id="trip-notes"
            rows={3}
            placeholder="e.g., Leaving from the church side of the plaza. No smoking."
            value={driverNotes}
            onChange={(e) => setDriverNotes(e.target.value)}
            className={FIELD}
          />
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
          {error}
          {rateTripId && (
            <>
              {' '}
              <Link href={`/auth/trips/${rateTripId}`} className="underline">
                Open that trip to rate them
              </Link>
            </>
          )}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting || Boolean(fuelPriceError)}
          className="rsu-btn-primary flex flex-1 items-center justify-center gap-2 disabled:opacity-60"
        >
          {isSubmitting && <FaSpinner className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting ? (isEdit ? 'Saving…' : 'Posting…') : isEdit ? 'Save changes' : 'Publish trip'}
        </button>
        <button
          type="button"
          onClick={() => {
            draft.clear();
            router.push(isEdit && editTrip ? `/auth/trips/${editTrip.id}` : '/auth/dashboard');
          }}
          className="rsu-btn-secondary flex-1"
        >
          Cancel
        </button>
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

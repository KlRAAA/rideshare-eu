'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FaSearch,
  FaSlidersH,
  FaUserPlus,
} from 'react-icons/fa';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import Select from '@/components/Select';
import Avatar from '@/components/Avatar';
import DatePicker from '@/components/DatePicker';
import TimePicker from '@/components/TimePicker';
import RequestToJoinModal from '@/components/RequestToJoinModal';
import Skeleton from '@/components/Skeleton';
import { apiFetch } from '@/lib/api';
import { formatTime, phTimeToUtcMinutes, getPhTodayDateString, getPhNowTimeString } from '@/lib/format';
import { tripRoute, tripWhen } from '@/lib/tripLine';
import { useCurrentLocationAddress } from '@/lib/useCurrentLocationAddress';
import { useGeocodedAddress } from '@/lib/useGeocodedAddress';
import AddressInput from '@/components/AddressInput';
import { useMediaQuery } from '@/lib/useMediaQuery';
import RouteMap from '@/components/RouteMap';
import type { LatLng } from '@/lib/directions';
import { searchFlexWindow } from '@/lib/searchWindow';
import RuleBadges from '@/components/RuleBadges';
import MatchWhy from '@/components/MatchWhy';
import TripFacts from '@/components/TripFacts';
import { TRIPS_I_SEE_OPTIONS, type GenderPreference } from '@/lib/riderRules';

interface Vehicle {
  make: string;
  model: string;
  color: string;
}

interface Host {
  id: string;
  fullName: string;
  role: string;
  avatarUrl?: string | null;
}

interface Trip {
  id: string;
  originAddress: string;
  destinationAddress: string;
  departureTime: string;
  recurrenceType: string;
  totalSeats: number;
  filledSeats: number;
  vehicle: Vehicle;
  status: string;
  host: Host;
  genderPreference: string;
  familiarRidersOnly: boolean;
}

interface MatchResult {
  tripId: string;
  score: number;
  routeOverlap: number;
  scheduleAlignment: number;
  preferenceMatch: boolean;
  fuelShare: number | null; // trip's fixed per-seat share; null if the trip has no computed distance
  trip: Trip;
}

type SortBy = 'best' | 'earliest';

const DEFAULT_DESTINATION = 'Enverga University, Lucena City';
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// A concrete "HH:MM" so the search always sends a real departureMinutes. An
// empty field previously serialized as `departureMinutes: null` and matched
// every trip against 00:00 (see matchController.isValidDepartureMinutes).
// Snapped to the 15-min marks the TimePicker offers.
function defaultSearchTime(): string {
  const now = getPhNowTimeString(); // "HH:MM" in Philippine time
  const m = TIME_RE.exec(now);
  if (!m) return '07:00';
  let hh = Number(m[1]);
  let mm = Math.round(Number(m[2]) / 15) * 15;
  if (mm === 60) {
    mm = 0;
    hh = (hh + 1) % 24;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export interface SearchInitialState {
  origin: string;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  destination: string;
  date: string;
  time: string;
  genderPreference: GenderPreference;
  flexibleTime: boolean;
  sortBy: SortBy;
}

// Search results are fetched client-side (runSearch below), not through a
// Server Component/Suspense boundary, so there's no loading.tsx for this
// page — the skeleton is wired directly into the existing `loading` state
// instead. Mirrors a real result Card: host avatar + name/role/match-percent,
// status badge, four icon+text detail lines, the vehicle/fuel-share line,
// and the two-button row.
function SearchResultCardSkeleton() {
  return (
    <Card>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <Skeleton shape="circle" width={40} height={40} />
          <div className="space-y-1.5">
            <Skeleton shape="text" width={110} height={13} />
            <Skeleton shape="text" width={70} height={10} />
          </div>
        </div>
        <Skeleton shape="rect" width={54} height={18} radius="9999px" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton shape="rect" width={12} height={12} radius="3px" />
            <Skeleton shape="text" width={i === 0 ? '70%' : '45%'} height={10} />
          </div>
        ))}
      </div>

      <Skeleton shape="text" width="55%" height={11} className="mt-2" />

      <div className="flex gap-2 mt-4">
        <Skeleton shape="rect" height={38} radius="var(--rsu-btn-radius)" className="flex-1" />
        <Skeleton shape="rect" height={38} radius="var(--rsu-btn-radius)" className="flex-1" />
      </div>
    </Card>
  );
}

interface SearchClientProps {
  passengerId: string;
  initial: SearchInitialState;
  // Women+ trips are for women and non-binary riders; the filter shows only for them.
  canUseWomenPlus: boolean;
  profilePreference: GenderPreference;
  // Trips the rider already asked to join (PENDING) or rides on (APPROVED).
  myRides: Record<string, string>;
}

export default function SearchClient({ passengerId, initial, canUseWomenPlus, profilePreference, myRides }: SearchClientProps) {
  const router = useRouter();

  const [origin, setOrigin] = useState(initial.origin);
  const {
    resolving: locatingOrigin,
    error: originLocationError,
    resolve: resolveCurrentLocation,
  } = useCurrentLocationAddress();
  // A pickup pin dragged on the map (or the device's own location) beats the
  // approximate address lookup; typing a new origin clears it.
  const [originPin, setOriginPin] = useState<LatLng | null>(initial.pickup);
  async function useMyCurrentLocation() {
    const result = await resolveCurrentLocation();
    if (!result) return;
    setOrigin(result.address);
    setOriginPin(result.coords);
  }
  const [destination, setDestination] = useState(initial.destination || DEFAULT_DESTINATION);
  // A picked suggestion sets the exact spot. Typed text that wasn't picked is
  // looked up once the field is left (Nominatim forbids per-keystroke lookups).
  const [destinationPin, setDestinationPin] = useState<LatLng | null>(initial.dropoff);
  const [originLookup, setOriginLookup] = useState(initial.origin);
  const [destinationLookup, setDestinationLookup] = useState(initial.destination || DEFAULT_DESTINATION);
  const { coords: geocodedOrigin, resolving: resolvingOrigin } = useGeocodedAddress(originPin ? '' : originLookup);
  const { coords: geocodedDestination, resolving: resolvingDestination } = useGeocodedAddress(destinationPin ? '' : destinationLookup);
  const pickupCoords = originPin ?? geocodedOrigin;
  const dropoffCoords = destinationPin ?? geocodedDestination;
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(() => initial.time || defaultSearchTime());
  const [genderPreference, setGenderPreference] = useState<GenderPreference>(initial.genderPreference);
  // Set by "Also show trips open to everyone": the rider still chose Women+
  // trips, so joining an open trip shows the warning (Women+ spec S6, S7).
  const [widenedFromWomenPlus, setWidenedFromWomenPlus] = useState(false);
  const womenPlusChosen = profilePreference === 'WOMEN_PLUS' || genderPreference === 'WOMEN_PLUS' || widenedFromWomenPlus;
  const [flexibleTime, setFlexibleTime] = useState(initial.flexibleTime);
  const [sortBy, setSortBy] = useState<SortBy>(initial.sortBy);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [joinedTripIds, setJoinedTripIds] = useState<Set<string>>(new Set());
  const [requestTarget, setRequestTarget] = useState<MatchResult | null>(null);
  const [searchGeo, setSearchGeo] = useState<{
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    // The time and window searched with, for each result's time and match explanation.
    time: string;
    flexWindow: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True only after the user clicks "Show all trips to <destination>" in the
  // empty state. Reset by every fresh search — a normal search always runs
  // PSGA matching first and never shows the fallback unprompted.
  const [isFallback, setIsFallback] = useState(false);

  // Mirror the form into the query string so router.back() from a result page
  // returns to the same search. Only non-default values, to keep URLs readable.
  const syncUrl = useCallback(() => {
    const q = new URLSearchParams();
    if (origin) q.set('origin', origin);
    if (originPin) {
      q.set('olat', originPin.lat.toFixed(6));
      q.set('olng', originPin.lng.toFixed(6));
    }
    if (destination && destination !== DEFAULT_DESTINATION) q.set('destination', destination);
    if (destinationPin) {
      q.set('dlat', destinationPin.lat.toFixed(6));
      q.set('dlng', destinationPin.lng.toFixed(6));
    }
    if (date) q.set('date', date);
    if (time) q.set('time', time);
    if (genderPreference !== profilePreference) q.set('show', genderPreference === 'WOMEN_PLUS' ? 'womenplus' : 'all');
    if (flexibleTime) q.set('flex', '1');
    if (sortBy !== 'best') q.set('sort', sortBy);
    const qs = q.toString();
    router.replace(qs ? `/auth/search?${qs}` : '/auth/search', { scroll: false });
  }, [origin, originPin, destination, destinationPin, date, time, genderPreference, profilePreference, flexibleTime, sortBy, router]);

  const isFirstSync = useRef(true);
  useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    const t = setTimeout(syncUrl, 300);
    return () => clearTimeout(t);
  }, [syncUrl]);

  // Landing back here with a complete search in the URL: re-run it once so the
  // results come back too, not just a repopulated form.
  const didAutoSearch = useRef(false);
  useEffect(() => {
    if (didAutoSearch.current) return;
    didAutoSearch.current = true;
    if (initial.origin && initial.destination && initial.date && initial.time) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    runSearch();
  }

  function showOpenTripsToo() {
    setWidenedFromWomenPlus(true);
    setGenderPreference('ANY');
    runSearch('ANY');
  }

  async function runSearch(preference: GenderPreference = genderPreference) {
    if (!TIME_RE.test(time)) {
      setSearched(true);
      setIsFallback(false);
      setError('Choose a preferred departure time.');
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    setIsFallback(false);

    try {
      const [originGeo, destinationGeo] = await Promise.all([
        originPin ?? apiFetch<{ lat: number; lng: number }>(`/api/geocode?q=${encodeURIComponent(origin)}`),
        destinationPin ?? apiFetch<{ lat: number; lng: number }>(`/api/geocode?q=${encodeURIComponent(destination)}`),
      ]);
      setSearchGeo({ origin: originGeo, destination: destinationGeo, time, flexWindow: searchFlexWindow(flexibleTime) });

      const [hh, mm] = time.split(':').map(Number);
      const departureMinutes = phTimeToUtcMinutes(hh, mm);

      const result = await apiFetch<{ status: 'MATCHED' | 'NO_MATCH'; matches: MatchResult[] }>('/api/matches/search', {
        method: 'POST',
        body: JSON.stringify({
          origin: { lat: originGeo.lat, lng: originGeo.lng },
          destination: { lat: destinationGeo.lat, lng: destinationGeo.lng },
          departureMinutes,
          date,
          flexWindowMinutes: searchFlexWindow(flexibleTime),
          genderPreference: preference,
        }),
      });

      setMatches(result.status === 'MATCHED' ? result.matches : []);
    } catch {
      setError('Couldn’t find rides for that route. Check the origin and destination and try again.');
      setMatches([]);
    } finally {
      setLoading(false);
      setMobileFiltersOpen(false);
    }
  }

  // Empty-state fallback. Reuses the origin/destination already geocoded by the
  // last search (no re-geocode) and asks the server for every trip heading to
  // the same destination, ignoring the route-overlap and departure-time gates.
  // Safety rules (Women+ trips, familiar riders only, the Women+ filter) are
  // still enforced server-side. Only reachable from the "No matching rides" card.
  async function runShowAll() {
    if (!searchGeo) return;
    if (!TIME_RE.test(time)) {
      setError('Choose a preferred departure time.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const [hh, mm] = time.split(':').map(Number);
      const departureMinutes = phTimeToUtcMinutes(hh, mm);

      const result = await apiFetch<{ status: 'MATCHED' | 'NO_MATCH'; matches: MatchResult[] }>('/api/matches/show-all', {
        method: 'POST',
        body: JSON.stringify({
          origin: { lat: searchGeo.origin.lat, lng: searchGeo.origin.lng },
          destination: { lat: searchGeo.destination.lat, lng: searchGeo.destination.lng },
          departureMinutes,
          date,
          flexWindowMinutes: searchFlexWindow(flexibleTime),
          genderPreference,
        }),
      });

      setMatches(result.status === 'MATCHED' ? result.matches : []);
      setIsFallback(true);
    } catch {
      setError('Couldn’t load trips to that destination. Try again.');
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  // The PSGA scores are computed here at search time and aren't stored on the
  // trip; the searcher's geocoded origin/destination likewise only exist in
  // this session. Both go to the Ride Details page as params so it can start a
  // request and draw the route-overlap layer. (The fuel share is on the trip.)
  function detailsHref(match: MatchResult) {
    const q = new URLSearchParams({
      score: String(match.score),
      overlap: String(match.routeOverlap),
      sched: String(match.scheduleAlignment),
      pref: match.preferenceMatch ? '1' : '0',
    });
    if (womenPlusChosen) q.set('show', 'womenplus'); // so Ride Details warns before joining an open trip
    if (searchGeo) {
      q.set('plat', String(searchGeo.origin.lat));
      q.set('plng', String(searchGeo.origin.lng));
      q.set('dlat', String(searchGeo.destination.lat));
      q.set('dlng', String(searchGeo.destination.lng));
    }
    return `/auth/rides/${match.tripId}?${q.toString()}`;
  }

  const sortedMatches = [...matches].sort((a, b) => {
    if (sortBy === 'earliest') return new Date(a.trip.departureTime).getTime() - new Date(b.trip.departureTime).getTime();
    return b.score - a.score; // already pre-sorted by the API, re-sort defensively
  });

  // Rendered only in whichever search form is visible (desktop card or the
  // mobile sheet), so a phone never loads a second, hidden map.
  const pickupMap = pickupCoords ? (
    <div className="mt-2">
      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Pickup spot</p>
      <RouteMap
        origin={pickupCoords}
        destination={dropoffCoords}
        onOriginChange={setOriginPin}
        heightClassName="h-44"
      />
      {originPin && (
        <p className="text-[11px] text-gray-500 mt-1">
          Using the exact spot on the map.{' '}
          <button
            type="button"
            onClick={() => setOriginPin(null)}
            className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
          >
            Use the address instead
          </button>
        </p>
      )}
    </div>
  ) : null;

  // idPrefix keeps ids unique: the desktop form stays in the page (hidden on a
  // phone) while the phone's filter sheet renders a second copy.
  const renderFilterFields = (showPickupMap: boolean, idPrefix: string) => (
    <>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={`${idPrefix}-origin`} className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Origin
          </label>
          <button
            type="button"
            onClick={useMyCurrentLocation}
            disabled={locatingOrigin}
            className="text-xs font-semibold text-[color:var(--rsu-color-primary)] hover:underline disabled:opacity-50"
          >
            {locatingOrigin ? 'Locating...' : 'Use my current location'}
          </button>
        </div>
        <AddressInput
          id={`${idPrefix}-origin`}
          busy={resolvingOrigin}
          required
          placeholder="e.g., Lucban, Tayabas"
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
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
        />
        {originLocationError && <p className="text-xs text-red-600 mt-1">{originLocationError}</p>}
        {showPickupMap && pickupMap}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-destination`} className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
          Destination
        </label>
        <AddressInput
          id={`${idPrefix}-destination`}
          busy={resolvingDestination}
          required
          placeholder="e.g., Enverga University"
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
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Preferred Time <span className="text-[color:var(--rsu-color-primary)]" aria-hidden="true">*</span>
          </label>
          <TimePicker
            min={date === getPhTodayDateString() ? getPhNowTimeString() : undefined}
            value={time}
            onChange={setTime}
            className="px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)] focus:border-[color:var(--rsu-color-primary)]"
          />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Filters</p>
        <div className="space-y-3">
          {canUseWomenPlus && (
            <div>
              <label htmlFor={`${idPrefix}-show`} className="block text-[11px] text-gray-500 mb-1">
                Show
              </label>
              <Select
                id={`${idPrefix}-show`}
                value={genderPreference}
                onChange={(e) => {
                  setGenderPreference(e.target.value as GenderPreference);
                  setWidenedFromWomenPlus(false);
                }}
                className="w-full pl-3 pr-9 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm"
              >
                {TRIPS_I_SEE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">
              Flexible Time
              <span className="block text-gray-400">Rides within ±{searchFlexWindow(flexibleTime)} min of your time</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={flexibleTime}
              onClick={() => setFlexibleTime((v) => !v)}
              className={`relative shrink-0 inline-flex w-11 h-6 rounded-full transition-colors ${flexibleTime ? 'bg-[color:var(--rsu-color-primary)]' : 'bg-gray-200'}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${flexibleTime ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </div>
      </div>

      <button type="submit" disabled={loading} className="rsu-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
        <FaSearch className="w-3.5 h-3.5" />
        {loading ? 'Searching...' : 'Search Rides'}
      </button>
    </>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <form onSubmit={handleSearch} className="hidden md:block rsu-card space-y-4 h-fit">
        <h2 className="text-sm font-bold text-gray-900">Search</h2>
        {renderFilterFields(isDesktop, 'search')}
      </form>

      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm"
        >
          <span className="text-sm text-gray-500">{origin ? `${origin} → ${destination}` : 'Search'}</span>
          <FaSlidersH className="w-4 h-4 text-gray-400" />
        </button>

        {mobileFiltersOpen && (
          // z-[70]: must render above BottomNav's fixed z-60 on mobile (see
          // globals.css), or the nav bar visually and interactively covers
          // the bottom of this sheet regardless of its own scroll behavior.
          <div className="fixed inset-0 bg-black/40 z-[70] flex items-end" onClick={() => setMobileFiltersOpen(false)}>
            {/* The rounded corners are on a wrapper that clips, not on the scrolling
                form: phone in-app browsers (Messenger's) paint a scrolling box's
                background square, which showed as white corners. */}
            <div className="w-full overflow-hidden rounded-t-2xl bg-white [isolation:isolate]" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSearch} className="max-h-[85vh] space-y-4 overflow-y-auto p-5 pb-8">
                <h2 className="text-sm font-bold text-gray-900">Search</h2>
                {renderFilterFields(!isDesktop, 'search-sheet')}
              </form>
            </div>
          </div>
        )}
      </div>

      <div className="md:col-span-2 space-y-4">
        {searched && (
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[color:var(--rsu-color-primary)]">
              {isFallback
                ? `${matches.length} trip${matches.length === 1 ? '' : 's'} to your destination`
                : `${matches.length} ride${matches.length === 1 ? '' : 's'} available`}
            </p>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="text-xs bg-white border border-gray-200 rounded-full pl-3 pr-7 py-1.5"
            >
              <option value="best">Best Match</option>
              <option value="earliest">Earliest departure</option>
            </Select>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        {loading && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <SearchResultCardSkeleton key={i} />
            ))}
          </>
        )}

        {!loading && !searched && (
          <Card>
            <p className="text-sm text-gray-400 text-center py-10">Enter your route to see ranked matches.</p>
          </Card>
        )}

        {searched && !loading && matches.length === 0 && !error && !isFallback && (
          <Card>
            <p className="text-sm text-gray-600 text-center py-6 font-medium">No matching rides right now</p>
            <p className="text-xs text-gray-400 text-center">
              {searchGeo
                ? `No trip goes your way within ±${searchGeo.flexWindow} min of your time. Try a wider flexible-time window, or see every trip going to ${destination} below.`
                : 'Try a wider flexible-time window, or check back later — new trips are posted throughout the day.'}
            </p>
            {genderPreference === 'WOMEN_PLUS' && (
              <div className="text-center mt-4">
                <button type="button" onClick={showOpenTripsToo} className="rsu-btn-secondary inline-flex px-4">
                  Also show trips open to everyone
                </button>
              </div>
            )}
            {searchGeo && (
              <div className="text-center mt-4">
                <button type="button" onClick={runShowAll} className="rsu-btn-secondary inline-flex px-4">
                  Show all trips going to {destination}
                </button>
              </div>
            )}
          </Card>
        )}

        {searched && !loading && !error && isFallback && (
          <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#b45309]">
            Trips that end at or pass {destination}, at any time of day. Check how far each one leaves from your time.
          </div>
        )}

        {searched && !loading && matches.length === 0 && !error && isFallback && (
          <Card>
            <p className="text-sm text-gray-600 text-center py-6 font-medium">No trips heading to {destination} right now</p>
            <p className="text-xs text-gray-400 text-center">
              Check back later — new trips are posted throughout the day.
            </p>
          </Card>
        )}

        {!loading && sortedMatches.map((match) => {
          const onRide = myRides[match.tripId] === 'APPROVED';
          const alreadyRequested = joinedTripIds.has(match.tripId) || myRides[match.tripId] === 'PENDING';
          const rideFull =
            match.trip.status === 'FULL' || match.trip.filledSeats >= match.trip.totalSeats;
          return (
            <Card key={match.tripId}>
              {/* Time first, like a timetable; the driver and the facts follow. */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold tabular-nums text-gray-900" suppressHydrationWarning>
                    {formatTime(match.trip.departureTime)}
                  </p>
                  <p className="text-sm text-gray-500" suppressHydrationWarning>
                    {tripWhen(match.trip)}
                  </p>
                </div>
                {onRide && <Badge tone="primary">You’re on this ride</Badge>}
              </div>
              <p className="mt-3 font-semibold text-gray-900">{tripRoute(match.trip)}</p>
              <Link href={`/auth/users/${match.trip.host.id}`} className="mt-1 inline-flex items-center gap-2 text-sm text-gray-600 hover:underline">
                <Avatar name={match.trip.host.fullName} src={match.trip.host.avatarUrl} sizeClass="w-6 h-6" textClass="text-[10px]" />
                {match.trip.host.fullName}
              </Link>
              <TripFacts
                className="mt-2"
                seats={{ total: match.trip.totalSeats, filled: match.trip.filledSeats }}
                fuelShare={match.fuelShare}
                vehicle={match.trip.vehicle}
              />
              <RuleBadges trip={match.trip} className="mt-2" />
              {searchGeo && (
                <div className="mt-3">
                  <MatchWhy match={match} departureTime={match.trip.departureTime} searchTime={searchGeo.time} flexWindowMinutes={searchGeo.flexWindow} />
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <Link href={onRide ? `/auth/trips/${match.tripId}` : detailsHref(match)} className="rsu-btn-secondary flex-1">
                  {onRide ? 'Open trip' : 'View details'}
                </Link>
                {!onRide && (
                  <button
                    type="button"
                    disabled={alreadyRequested || rideFull}
                    onClick={() => setRequestTarget(match)}
                    className="rsu-btn-primary flex flex-1 items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <FaUserPlus className="h-3.5 w-3.5" aria-hidden />
                    {alreadyRequested ? 'Requested' : rideFull ? 'Ride full' : 'Request to join'}
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {requestTarget && (
        <RequestToJoinModal
          tripId={requestTarget.tripId}
          passengerId={passengerId}
          hostName={requestTarget.trip.host.fullName}
          matchPayload={{
            score: requestTarget.score,
            routeOverlap: requestTarget.routeOverlap,
            scheduleAlignment: requestTarget.scheduleAlignment,
            preferenceMatch: requestTarget.preferenceMatch,
          }}
          tripGenderPreference={requestTarget.trip.genderPreference}
          riderPreference={womenPlusChosen ? 'WOMEN_PLUS' : 'ANY'}
          onClose={() => setRequestTarget(null)}
          onSubmitted={() => {
            setJoinedTripIds((prev) => new Set(prev).add(requestTarget.tripId));
            setRequestTarget(null);
          }}
        />
      )}
    </div>
  );
}

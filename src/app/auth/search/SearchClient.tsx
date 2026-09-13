'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FaSearch,
  FaSlidersH,
  FaMapMarkerAlt,
  FaClock,
  FaCalendarAlt,
  FaUsers,
  FaUserPlus,
} from 'react-icons/fa';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import Select from '@/components/Select';
import Avatar from '@/components/Avatar';
import DatePicker from '@/components/DatePicker';
import TimePicker from '@/components/TimePicker';
import RequestToJoinModal from '@/components/RequestToJoinModal';
import { apiFetch } from '@/lib/api';
import { formatDate, formatTime, roleLabel, phTimeToUtcMinutes, getPhTodayDateString, getPhNowTimeString } from '@/lib/format';
import { tripStatusBadge } from '@/lib/statusBadge';
import { useCurrentLocationAddress } from '@/lib/useCurrentLocationAddress';

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
  totalSeats: number;
  filledSeats: number;
  vehicle: Vehicle;
  status: string;
  host: Host;
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
  destination: string;
  date: string;
  time: string;
  genderPreference: 'ANY' | 'SAME_GENDER';
  flexibleTime: boolean;
  sortBy: SortBy;
}

export default function SearchClient({
  passengerId,
  initial,
}: {
  passengerId: string;
  initial: SearchInitialState;
}) {
  const router = useRouter();

  const [origin, setOrigin] = useState(initial.origin);
  const {
    resolving: locatingOrigin,
    error: originLocationError,
    resolve: resolveCurrentLocation,
  } = useCurrentLocationAddress();
  // Sets the same text state manual typing would — origin/destination are
  // only ever forward-geocoded at search-submit time here (runSearch below),
  // so there's no separate coordinate state to keep in sync ahead of that.
  async function useMyCurrentLocation() {
    const address = await resolveCurrentLocation();
    if (address) setOrigin(address);
  }
  const [destination, setDestination] = useState(initial.destination || DEFAULT_DESTINATION);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(() => initial.time || defaultSearchTime());
  const [genderPreference, setGenderPreference] = useState<'ANY' | 'SAME_GENDER'>(initial.genderPreference);
  const [flexibleTime, setFlexibleTime] = useState(initial.flexibleTime);
  const [sortBy, setSortBy] = useState<SortBy>(initial.sortBy);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [joinedTripIds, setJoinedTripIds] = useState<Set<string>>(new Set());
  const [requestTarget, setRequestTarget] = useState<MatchResult | null>(null);
  const [searchGeo, setSearchGeo] = useState<{
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
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
    if (destination && destination !== DEFAULT_DESTINATION) q.set('destination', destination);
    if (date) q.set('date', date);
    if (time) q.set('time', time);
    if (genderPreference !== 'ANY') q.set('gender', genderPreference);
    if (flexibleTime) q.set('flex', '1');
    if (sortBy !== 'best') q.set('sort', sortBy);
    const qs = q.toString();
    router.replace(qs ? `/auth/search?${qs}` : '/auth/search', { scroll: false });
  }, [origin, destination, date, time, genderPreference, flexibleTime, sortBy, router]);

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

  async function runSearch() {
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
        apiFetch<{ lat: number; lng: number }>(`/api/geocode?q=${encodeURIComponent(origin)}`),
        apiFetch<{ lat: number; lng: number }>(`/api/geocode?q=${encodeURIComponent(destination)}`),
      ]);
      setSearchGeo({ origin: originGeo, destination: destinationGeo });

      const [hh, mm] = time.split(':').map(Number);
      const departureMinutes = phTimeToUtcMinutes(hh, mm);

      const result = await apiFetch<{ status: 'MATCHED' | 'NO_MATCH'; matches: MatchResult[] }>('/api/matches/search', {
        method: 'POST',
        body: JSON.stringify({
          passengerId,
          origin: { lat: originGeo.lat, lng: originGeo.lng },
          destination: { lat: destinationGeo.lat, lng: destinationGeo.lng },
          departureMinutes,
          flexWindowMinutes: flexibleTime ? 30 : 0,
          genderPreference,
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
  // Safety constraints (gender preference, familiar-riders-only) are still
  // enforced server-side. Only reachable from the "No matching rides" card.
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
          passengerId,
          origin: searchGeo.origin,
          destination: searchGeo.destination,
          departureMinutes,
          flexWindowMinutes: flexibleTime ? 30 : 0,
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

  const filterFields = (
    <>
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
          placeholder="e.g., Lucban, Tayabas"
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
          placeholder="e.g., Enverga University"
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
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Gender Preference</label>
            <Select
              value={genderPreference}
              onChange={(e) => setGenderPreference(e.target.value as 'ANY' | 'SAME_GENDER')}
              className="w-full pl-3 pr-9 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm"
            >
              <option value="ANY">Any</option>
              <option value="SAME_GENDER">Same-gender only</option>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Flexible Time (±30 min window)</span>
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
        {filterFields}
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
            <form
              onSubmit={handleSearch}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-5 pb-8 space-y-4"
            >
              <h2 className="text-sm font-bold text-gray-900">Search</h2>
              {filterFields}
            </form>
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

        {!searched && (
          <Card>
            <p className="text-sm text-gray-400 text-center py-10">Enter your route to see ranked matches.</p>
          </Card>
        )}

        {searched && !loading && matches.length === 0 && !error && !isFallback && (
          <Card>
            <p className="text-sm text-gray-600 text-center py-6 font-medium">No matching rides right now</p>
            <p className="text-xs text-gray-400 text-center">
              Try a wider flexible-time window, or check back later — new trips are posted throughout the day.
            </p>
            {searchGeo && (
              <div className="text-center mt-4">
                <button type="button" onClick={runShowAll} className="rsu-btn-secondary inline-flex px-4">
                  Show all trips to {destination} instead
                </button>
              </div>
            )}
          </Card>
        )}

        {searched && !loading && !error && isFallback && (
          <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#b45309]">
            Not matched by route or schedule — shown because your search returned no matches.
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

        {sortedMatches.map((match) => {
          const status = tripStatusBadge(match.trip.status);
          const alreadyRequested = joinedTripIds.has(match.tripId);
          const rideFull =
            match.trip.status === 'FULL' || match.trip.filledSeats >= match.trip.totalSeats;
          return (
            <Card key={match.tripId}>
              <div className="flex justify-between items-start mb-3">
                <Link href={`/auth/users/${match.trip.host.id}`} className="flex items-center gap-3 min-w-0 hover:underline">
                  <Avatar name={match.trip.host.fullName} src={match.trip.host.avatarUrl} sizeClass="w-10 h-10" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900">{match.trip.host.fullName}</h4>
                      <Badge tone="neutral">{roleLabel(match.trip.host.role)}</Badge>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600">{Math.round(match.score * 100)}% match</span>
                  </div>
                </Link>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>

              <div className="text-xs text-gray-600 space-y-1.5">
                <p className="flex items-start gap-2">
                  <FaMapMarkerAlt className="w-3 h-3 mt-0.5 text-gray-400 shrink-0" />
                  <span>
                    <span className="font-semibold text-gray-800">{match.trip.originAddress}</span>
                    <br />
                    <span className="text-gray-400">to {match.trip.destinationAddress}</span>
                  </span>
                </p>
                <p className="flex items-center gap-2" suppressHydrationWarning>
                  <FaClock className="w-3 h-3 text-gray-400" />
                  {formatTime(match.trip.departureTime)}
                </p>
                <p className="flex items-center gap-2" suppressHydrationWarning>
                  <FaCalendarAlt className="w-3 h-3 text-gray-400" />
                  {formatDate(match.trip.departureTime)}
                </p>
                <p className="flex items-center gap-2">
                  <FaUsers className="w-3 h-3 text-gray-400" />
                  {match.trip.totalSeats - match.trip.filledSeats} seat{match.trip.totalSeats - match.trip.filledSeats === 1 ? '' : 's'} available (
                  {match.trip.filledSeats}/{match.trip.totalSeats} filled)
                </p>
                <p className="text-[color:var(--rsu-color-primary)] font-semibold">
                  {match.trip.vehicle.make} {match.trip.vehicle.model} ({match.trip.vehicle.color})
                  {match.fuelShare != null && ` · ₱${match.fuelShare.toFixed(0)} per seat`}
                </p>
              </div>

              <div className="flex gap-2 mt-4">
                <Link href={detailsHref(match)} className="rsu-btn-secondary flex-1">
                  View Details
                </Link>
                <button
                  type="button"
                  disabled={alreadyRequested || rideFull}
                  onClick={() => setRequestTarget(match)}
                  className="rsu-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FaUserPlus className="w-3.5 h-3.5" />
                  {alreadyRequested ? 'Requested' : rideFull ? 'Ride Full' : 'Request to Join'}
                </button>
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

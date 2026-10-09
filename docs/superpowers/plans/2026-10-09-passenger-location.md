# Passenger Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An approved rider can share their live location with the trip's driver from 15 minutes before departure until the trip starts.

**Architecture:** Four `Match` columns (the switch and the latest point). Pure window/distance rules in `server/services/riderLocationRules.js`; DB work in `server/services/riderLocationService.js`. Routes: `PATCH /api/matches/:id/location-sharing`, `POST /api/trips/:id/rider-location`, `GET /api/trips/:id/rider-locations`. The rider's trip page sends every 30 s while on and in the window; the driver's page polls and shows pins and a list.

**Tech Stack:** Express 5, Prisma 7, Next.js 16 / React 19, Jest 30.

**Spec:** `docs/superpowers/specs/2026-10-09-passenger-location-design.md`

## Global Constraints

- Window: `departure − 15 min ≤ now ≤ departure + 60 min` for `nextDeparture(trip, now, closedDays)`, and no ONGOING/COMPLETED run that day.
- Only the trip's host reads positions; a point older than 30 minutes reads as none; `atPickup` within 100 m of the meeting point (else origin).
- Erase: Start Trip (whole trip), switch off, account deletion, cron (older than 30 minutes or match not APPROVED).
- Additive schema; back up first. Commits as `Xyrus <xyrusdimacali@gmail.com>`, no AI trailers.

---

### Task 1: Data and rules

**Files:** `prisma/schema.prisma` (Match: `sharesLocation Boolean @default(false)`, `riderLat Float?`, `riderLng Float?`, `riderLocatedAt DateTime?`); Create `server/services/riderLocationRules.js` (`sharingWindow(departure) → { opensAt, closesAt }`, `inWindow(departure, now)`, `pickupStatus(point, trip) → { metersToPickup, atPickup }`, `SHARE_BEFORE_MS`, `AT_PICKUP_M`, `STALE_MS`); Test `server/services/__tests__/riderLocationRules.test.js`.

- [ ] Backup; schema; generate; `db push` dev + demo.
- [ ] Failing test: window opens exactly at −15 min and closes at +60 min; 80 m from the meeting point is at pickup, 350 m isn't (and reports ~350); origin used without a meeting point.
- [ ] Implement (reuse `arrivalRules.pickupPoint` and `psgaService.haversineMeters`); PASS; commit `feat: rider location data and rules`.

### Task 2: API

**Files:** Create `server/services/riderLocationService.js` (`setSharing`, `saveRiderLocation`, `riderLocationsFor`, `clearTripRiderLocations(tripId)`, `clearStaleRiderLocations(now)`); `server/controllers/matchController.js` (`setLocationSharing`); `server/routes/matchRoutes.js`; `server/controllers/tripRunController.js` (`postRiderLocation`, `getRiderLocations`); `server/routes/tripRoutes.js`; `server/validation/bodySchemas.js` (`match.locationSharing: { on: 'boolean' }`, `trip.riderLocation: LAT_LNG`); `server/services/tripRunService.js` (`startRun` clears); `server/services/accountDeletionService.js`; `server/server.js` (cron runs `clearStaleRiderLocations`); `server/controllers/tripController.js` (`getById` adds `myLocationSharing`); `server/__tests__/crossUserAccess.test.js`; Test `server/__tests__/riderLocation.test.js`.

- [ ] Failing tests (trip departing in 10 minutes, so the window is open; host, approved rider, pending rider, other approved rider):
  - switch: rider on → 200 `{ sharesLocation: true }`; host or other user → 403; pending rider → 409 `NOT_APPROVED`;
  - post: before switching on → 409 `NOT_SHARING`; after → 200; trip departing tomorrow → 409 `NOT_IN_WINDOW` with `opensAt`; bad coordinates → 400 `INVALID_COORDINATES`;
  - read: host sees the rider with `sharing`, `location`, `metersToPickup`, `atPickup`; a not-sharing rider listed with `location: null`; the rider or another passenger → 403;
  - stale: `riderLocatedAt` 31 minutes ago → `location: null`;
  - off erases; Start Trip erases and then post → 409 `TRIP_STARTED`; `clearStaleRiderLocations` erases an old point and a cancelled match's point; account deletion erases;
  - `GET /api/trips/:id` as the rider includes `myLocationSharing`.
- [ ] Implement; run with `strictBody`, `crossUserAccess`, `tripRuns`, `accountDeletion` — PASS. Commit `feat: riders share their location with the driver before pickup`.

### Task 3: Screens

**Files:** Create `src/lib/riderLocation.ts` (`riderStatusLine(r, now)`, `sharingState(departure, now)`) + test; Create `src/components/RiderLocationCard.tsx` (rider: switch, state text, sending loop); Create `src/components/RidersNearbyCard.tsx` (driver: poll + list); `src/components/RouteMapView.tsx` (`riderLocations?: { lat, lng, label }[]` emerald pins, in the fitted view, legend item); `src/components/LiveRouteMap.tsx` (pass-through); `src/app/auth/trips/[id]/TripDetailClient.tsx` (wire both, sharing riders' pins from the driver card's data).

- [ ] Failing web test: "Maria · at the meeting point · 1 min ago", "350 m away · just now", "1.2 km away", "not sharing"; `sharingState` → `before` (with opensAt label) / `open` / `closed`.
- [ ] Implement; `tsc` + web tests — PASS. Commit `feat: rider location on the trip page`.

### Task 4: Postman, docs, verification

- [ ] Postman "23. Rider location": host posts a trip leaving in 5 minutes, passenger joins, host approves; passenger switches sharing on; posts a location; host reads it (`atPickup` boolean, `metersToPickup` number); passenger can't read (403); host starts the trip; passenger's post → 409 `TRIP_STARTED`; host ends the trip (clean-up).
- [ ] Full suites, tsc, Postman; browser (demo: reseed for a fresh soon trip; Paolo turns sharing on with a granted geolocation near the meeting point; Miguel sees the pin and "at the meeting point").
- [ ] AGENTS.md "G. Passenger location"; roadmap G → done. Commit `docs: passenger location notes and Postman folder`.

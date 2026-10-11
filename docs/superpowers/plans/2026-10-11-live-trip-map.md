# Live Trip Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a trip runs, the driver and riders see each other on our map; riders keep sharing until the driver taps "Picked up"; the driver gets a next-turn banner, rerouting, both arrival times and a Navigate hand-off to Google Maps / Waze.

**Architecture:** Server: two optional columns (`Match.pickedUpAt`, `TripRun.pickupEtaAt`), picked-up endpoints, and the G sharing rules extended past Start Trip (all in `riderLocationService`). Web: a pure `src/lib/navigation.ts` (route parsing, position on the line, next maneuver, links), `fetchNavRoute` in `directions.ts`, a `useDriverNavigation` hook that replaces the 30 s send loop, small display components, and theme-aware `RouteMapView`.

**Tech Stack:** Express + Prisma (Postgres), Jest (server: `jest server`; web: `jest -c jest.web.config.mjs`), Next.js client components, react-map-gl/mapbox, Mapbox Directions API, react-icons.

**Spec:** `docs/superpowers/specs/2026-10-11-live-trip-map-design.md`

## Global Constraints

- Schema changes are only the two additive optional fields: `Match.pickedUpAt DateTime?`, `TripRun.pickupEtaAt DateTime?` (approved exception to the UAT freeze).
- Every write route runs `strictBody('<name>')` with a schema in `server/validation/bodySchemas.js`; new routes get a row in `server/__tests__/crossUserAccess.test.js`.
- Rider positions and pickup times are never shown to admins or in data releases.
- Theme: maroon `#800000` (`--rsu-color-primary`), app cards/buttons (`rsu-card`, `rsu-btn-primary`, `rsu-btn-secondary`); map style `mapbox://styles/mapbox/dark-v11` when `<html data-theme="dark">`, else `light-v11`.
- Driver position sent every **10 s**; route refetch: off route > **50 m** for 2 fixes in a row (at most once per **15 s**), every **2 min**, and when the pickup leg appears/disappears.
- A driver point is served up to **10 minutes** old; the client calls it paused after **45 s**.
- No new dependencies. No `window.confirm/alert`, no raw `<select>`.
- Commits as `Xyrus <xyrusdimacali@gmail.com>`, no AI trailers.
- Server tests: `npx jest <file> --testTimeout=15000`. Web tests: `npx jest -c jest.web.config.mjs <file>`. Types: `npx tsc --noEmit -p .`.

---

### Task 1: Schema fields and the `isPickedUp` rule

**Files:**
- Modify: `prisma/schema.prisma` (model `Match` after `riderLocatedAt`; model `TripRun` after `etaAt`)
- Modify: `server/services/riderLocationRules.js`
- Create: `server/__tests__/riderLocationRules.test.js`

**Interfaces:**
- Produces: `isPickedUp(pickedUpAt: Date|null, run: { startedAt: Date|null } | null) → boolean` exported from `riderLocationRules.js`; Prisma fields `Match.pickedUpAt`, `TripRun.pickupEtaAt`.

- [ ] **Step 1: Write the failing test**

```js
// server/__tests__/riderLocationRules.test.js
const { isPickedUp } = require('../services/riderLocationRules');

const start = new Date('2026-10-12T07:00:00+08:00');
const run = { startedAt: start };

test('a rider counts as picked up only when tapped during this run', () => {
  expect(isPickedUp(null, run)).toBe(false);
  expect(isPickedUp(start, run)).toBe(true);
  expect(isPickedUp(new Date(start.getTime() + 60 * 1000), run)).toBe(true);
  // Yesterday's pickup on a recurring trip doesn't count today.
  expect(isPickedUp(new Date(start.getTime() - 24 * 3600 * 1000), run)).toBe(false);
  expect(isPickedUp(new Date(), null)).toBe(false);
  expect(isPickedUp(new Date(), { startedAt: null })).toBe(false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest server/__tests__/riderLocationRules.test.js`
Expected: FAIL, `isPickedUp is not a function`.

- [ ] **Step 3: Add the rule**

In `server/services/riderLocationRules.js`, above `module.exports`:

```js
// Live trip map: a rider is picked up for a run when the driver tapped
// "Picked up" after that run started, so a recurring trip starts fresh each day.
function isPickedUp(pickedUpAt, run) {
  return Boolean(pickedUpAt && run?.startedAt && pickedUpAt >= run.startedAt);
}
```

and add `isPickedUp` to the exported object.

- [ ] **Step 4: Add the two schema fields**

In `prisma/schema.prisma`, model `Match`, change the G comment and add the field after `riderLocatedAt DateTime?`:

```prisma
  // Sub-project G: the rider's switch and latest position, shown only to the
  // trip's driver until pickup (live trip map: erased at pickup or run end).
  sharesLocation    Boolean     @default(false)
  riderLat          Float?
  riderLng          Float?
  riderLocatedAt    DateTime?
  pickedUpAt        DateTime? // the driver tapped "Picked up"; counts for the run it falls in
```

In model `TripRun`, after `etaAt DateTime?`:

```prisma
  pickupEtaAt           DateTime? // expected arrival at the meeting point (live trip map)
```

- [ ] **Step 5: Apply locally and regenerate the client**

Run: `node scripts/backup-db.mjs` then `npx prisma db push` then `npx prisma generate`
Expected: "Your database is now in sync with your Prisma schema", no data-loss warning.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest server/__tests__/riderLocationRules.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma server/services/riderLocationRules.js server/__tests__/riderLocationRules.test.js
git commit -m "feat: pickedUpAt and pickupEtaAt for the live trip map"
```

---

### Task 2: Picked-up endpoints

**Files:**
- Modify: `server/services/riderLocationService.js`
- Modify: `server/controllers/matchController.js` (import line 2, new handlers next to `setLocationSharing` at line 330, `module.exports` line 515)
- Modify: `server/routes/matchRoutes.js`
- Modify: `server/validation/bodySchemas.js` (next to `'match.locationSharing'`)
- Test: `server/__tests__/riderLocation.test.js`, `server/__tests__/crossUserAccess.test.js`

**Interfaces:**
- Consumes: `isPickedUp` (Task 1), `CLEARED`, `fail` in `riderLocationService.js`.
- Produces: `setPickedUp(matchId, userId, pickedUp: boolean, now?) → { status, body }`; `ongoingRunOf(tripId) → Promise<{ startedAt } | null>` (module-local helper, reused by Task 3); routes `POST|DELETE /api/matches/:id/picked-up` → `200 { pickedUp }`.

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/riderLocation.test.js`:

```js
const pickUp = (matchId, userId, method = 'POST') => req(method, `/api/matches/${matchId}/picked-up`, userId, {});

test('the driver marks a rider picked up during the trip, and can undo it', async () => {
  if (guard()) return;
  const s = await seed();
  await err(await pickUp(s.match.id, s.host.id), 409, 'NO_ONGOING_RUN');
  expect((await req('POST', `/api/trips/${s.trip.id}/start`, s.host.id, {})).status).toBe(201);
  expect((await pickUp(s.match.id, s.rider.id)).status).toBe(403);
  await err(await pickUp(s.pendingMatch.id, s.host.id), 409, 'NOT_APPROVED');
  expect((await pickUp('no-such-match', s.host.id)).status).toBe(404);

  await prisma.match.update({ where: { id: s.match.id }, data: { riderLat: NEAR.lat, riderLng: NEAR.lng, riderLocatedAt: new Date() } });
  const res = await pickUp(s.match.id, s.host.id);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ pickedUp: true });
  const row = await prisma.match.findUnique({ where: { id: s.match.id } });
  expect(row.pickedUpAt).toBeInstanceOf(Date);
  expect(row.riderLat).toBeNull();

  const undo = await pickUp(s.match.id, s.host.id, 'DELETE');
  expect(undo.status).toBe(200);
  expect(await undo.json()).toEqual({ pickedUp: false });
  expect((await prisma.match.findUnique({ where: { id: s.match.id } })).pickedUpAt).toBeNull();
});
```

In `server/__tests__/crossUserAccess.test.js`, after the `'switch location sharing on A’s join request'` row, add:

```js
  ['mark A picked up', 'POST', () => `/api/matches/${a.match.id}/picked-up`],
  ['undo A picked up', 'DELETE', () => `/api/matches/${a.match.id}/picked-up`],
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest server/__tests__/riderLocation.test.js server/__tests__/crossUserAccess.test.js --testTimeout=15000`
Expected: the new rider test FAILS (404 instead of 409); the two access rows may pass already (404). `strictBody.test.js` will fail after Step 4 if the schema is missing; that's the point of Step 3.

- [ ] **Step 3: Implement the service**

In `server/services/riderLocationService.js`:
- change the rules import to `const { sharingWindow, inWindow, pickupStatus, isPickedUp, STALE_MS } = require('./riderLocationRules');`
- add after `validPoint`:

```js
// The run on the road now, if any. Read here rather than from tripRunService,
// which requires this module (a circular import).
function ongoingRunOf(tripId) {
  return prisma.tripRun.findFirst({ where: { tripId, status: 'ONGOING' }, select: { startedAt: true } });
}
```

- add after `setSharing`:

```js
// Live trip map: the driver taps "Picked up" (or Undo) for a rider while the
// trip runs. Pickup erases the rider's position at once.
async function setPickedUp(matchId, userId, pickedUp, now = new Date()) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { tripId: true, status: true, trip: { select: { hostId: true } } },
  });
  if (!match) return fail(404, { error: 'MATCH_NOT_FOUND' });
  if (match.trip.hostId !== userId) return fail(403, { error: 'NOT_AUTHORIZED' });
  if (match.status !== 'APPROVED') return fail(409, { error: 'NOT_APPROVED' });
  if (!(await ongoingRunOf(match.tripId))) return fail(409, { error: 'NO_ONGOING_RUN' });
  await prisma.match.update({ where: { id: matchId }, data: pickedUp ? { pickedUpAt: now, ...CLEARED } : { pickedUpAt: null } });
  return { status: 200, body: { pickedUp } };
}
```

- add `setPickedUp` to `module.exports`.

- [ ] **Step 4: Controller, route and schema**

`server/controllers/matchController.js` line 2:

```js
const { setSharing, setPickedUp } = require('../services/riderLocationService');
```

after `setLocationSharing`:

```js
// Live trip map: the driver marks a rider picked up, or undoes it.
async function markPickedUp(req, res) {
  const { status, body } = await setPickedUp(req.params.id, req.user.id, true);
  res.status(status).json(body);
}
async function undoPickedUp(req, res) {
  const { status, body } = await setPickedUp(req.params.id, req.user.id, false);
  res.status(status).json(body);
}
```

and export them: `module.exports = { search, showAll, create, updateStatus, routeOverlap, setLocationSharing, markPickedUp, undoPickedUp };`

`server/routes/matchRoutes.js`: import `markPickedUp, undoPickedUp` with the others and add after the location-sharing route:

```js
router.post('/matches/:id/picked-up', strictBody('match.pickedUp'), markPickedUp); // driver, while the trip runs
router.delete('/matches/:id/picked-up', strictBody('match.pickedUp'), undoPickedUp);
```

`server/validation/bodySchemas.js`, after `'match.locationSharing': { on: 'boolean' },`:

```js
  'match.pickedUp': NONE,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest server/__tests__/riderLocation.test.js server/__tests__/crossUserAccess.test.js server/__tests__/strictBody.test.js --testTimeout=15000`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add server/services/riderLocationService.js server/controllers/matchController.js server/routes/matchRoutes.js server/validation/bodySchemas.js server/__tests__/riderLocation.test.js server/__tests__/crossUserAccess.test.js
git commit -m "feat: driver marks riders picked up during the trip"
```

---

### Task 3: Riders keep sharing after Start Trip until picked up

**Files:**
- Modify: `server/services/riderLocationService.js` (`saveRiderLocation`, `riderLocationsFor`)
- Modify: `server/services/tripRunService.js` (`startRun` line 44, `finishRun`)
- Test: `server/__tests__/riderLocation.test.js`

**Interfaces:**
- Consumes: `ongoingRunOf`, `isPickedUp` (Tasks 1–2).
- Produces: `POST /api/trips/:id/rider-location` → 409 `PICKED_UP` after pickup; `GET /api/trips/:id/rider-locations` rows gain `pickedUp: boolean`.

- [ ] **Step 1: Write the failing test and update the erase test**

Append to `server/__tests__/riderLocation.test.js`:

```js
test('after Start Trip riders keep sharing until the driver picks them up', async () => {
  if (guard()) return;
  const s = await seed();
  await share(s, s.rider.id, s.match.id);
  expect((await req('POST', `/api/trips/${s.trip.id}/start`, s.host.id, {})).status).toBe(201);
  expect((await post(s, s.rider.id, FAR)).status).toBe(200);
  let riders = (await (await read(s, s.host.id)).json()).riders;
  expect(riders.find((r) => r.passengerId === s.rider.id)).toMatchObject({ pickedUp: false, sharing: true, location: FAR });

  expect((await req('POST', `/api/matches/${s.match.id}/picked-up`, s.host.id, {})).status).toBe(200);
  await err(await post(s, s.rider.id, NEAR), 409, 'PICKED_UP');
  riders = (await (await read(s, s.host.id)).json()).riders;
  expect(riders.find((r) => r.passengerId === s.rider.id)).toMatchObject({ pickedUp: true, location: null });
  expect(riders.find((r) => r.passengerId === s.quiet.id)).toMatchObject({ pickedUp: false, sharing: false });
});
```

In the test `'positions are erased: switch off, Start Trip, the cleanup job and account deletion'`, rename it to `'positions are erased: switch off, trip end, the cleanup job and account deletion'` and replace these four lines:

```js
  expect((await req('POST', `/api/trips/${s.trip.id}/start`, s.host.id, {})).status).toBe(201);
  expect((await point(s.match.id)).riderLat).toBeNull();
  await err(await post(s, s.rider.id, NEAR), 409, 'TRIP_STARTED');
  expect((await (await read(s, s.host.id)).json()).riders).toEqual([]);
```

with:

```js
  expect((await req('POST', `/api/trips/${s.trip.id}/start`, s.host.id, {})).status).toBe(201);
  expect((await point(s.match.id)).riderLat).not.toBeNull(); // kept for pickup after the start
  expect((await req('POST', `/api/trips/${s.trip.id}/end`, s.host.id, {})).status).toBe(200);
  expect((await point(s.match.id)).riderLat).toBeNull();
  expect((await post(s, s.rider.id, NEAR)).status).toBe(409);
  expect((await (await read(s, s.host.id)).json()).riders).toEqual([]);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest server/__tests__/riderLocation.test.js --testTimeout=15000`
Expected: FAIL (`TRIP_STARTED` on the post after start; `riderLat` null right after start).

- [ ] **Step 3: Extend `saveRiderLocation`**

Replace its body after `if (!match.sharesLocation) …`:

```js
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      matches: { where: { passengerId: userId, status: 'APPROVED' }, select: { id: true, sharesLocation: true, pickedUpAt: true } },
    },
  });
  if (!trip) return fail(404, { error: 'TRIP_NOT_FOUND' });
  const [match] = trip.matches;
  if (!match) return fail(403, { error: 'NOT_AUTHORIZED' });
  if (!match.sharesLocation) return fail(409, { error: 'NOT_SHARING' });
  // Live trip map: during the run a rider shares until the driver picks them up.
  const run = await ongoingRunOf(tripId);
  if (run) {
    if (isPickedUp(match.pickedUpAt, run)) return fail(409, { error: 'PICKED_UP' });
  } else {
    const current = await currentDeparture(trip, now);
    if (current.error) return current.error;
  }
  await prisma.match.update({ where: { id: match.id }, data: { riderLat: point.lat, riderLng: point.lng, riderLocatedAt: now } });
  return { status: 200, body: { ok: true } };
```

(keep the `validPoint` check at the top as it is).

- [ ] **Step 4: Extend `riderLocationsFor`**

Replace from `const current = await currentDeparture(trip, now);` to the end of the `riders` map with:

```js
  const run = await ongoingRunOf(tripId);
  if (!run) {
    const current = await currentDeparture(trip, now);
    if (current.error?.body.error === 'TRIP_STARTED') return { status: 200, body: { riders: [] } };
  }

  const riders = trip.matches.map((m) => {
    const pickedUp = isPickedUp(m.pickedUpAt, run);
    const fresh = !pickedUp && m.riderLat != null && m.riderLocatedAt && now - m.riderLocatedAt <= STALE_MS;
    const location = fresh ? { lat: m.riderLat, lng: m.riderLng } : null;
    return {
      matchId: m.id,
      passengerId: m.passengerId,
      fullName: decryptUserFields(m.passenger).fullName,
      sharing: m.sharesLocation,
      pickedUp,
      location,
      updatedAt: fresh ? m.riderLocatedAt : null,
      ...(location ? pickupStatus(location, trip) : { metersToPickup: null, atPickup: false }),
    };
  });
```

Update the file's first comment to: `// Riders share their location with the trip's driver until pickup (sub-project G, live trip map).`

- [ ] **Step 5: Stop erasing at start; erase at run end**

`server/services/tripRunService.js`: delete line 44 (`await clearTripRiderLocations(tripId); // riders' positions are for pickup only (sub-project G)`). In `finishRun`, right after the `updateMany` call:

```js
  // Riders' positions are for pickup only: gone once the run ends (live trip map).
  if (count > 0) await clearTripRiderLocations(run.tripId);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest server/__tests__/riderLocation.test.js server/__tests__/riderLocationRules.test.js server/__tests__/tripRuns.test.js --testTimeout=15000`
Expected: all PASS. If a `tripRuns.test.js` assertion expected locations erased at start, change it to expect them erased at end (same pattern as Step 1).

- [ ] **Step 7: Commit**

```bash
git add server/services/riderLocationService.js server/services/tripRunService.js server/__tests__/riderLocation.test.js server/__tests__/tripRuns.test.js
git commit -m "feat: riders share their location after Start Trip until picked up"
```

---

### Task 4: Driver location carries the pickup ETA, pickup status and paused points

**Files:**
- Modify: `server/controllers/tripRunController.js` (`updateLocation`, `getLocation`, constants)
- Modify: `server/validation/bodySchemas.js` line 103 (`'trip.location'`)
- Test: `server/__tests__/tripLocation.test.js`

**Interfaces:**
- Consumes: `isPickedUp` (Task 1).
- Produces: `POST /api/trips/:id/location` accepts `pickupEtaSeconds`; `GET /api/trips/:id/location` → `{ location: { lat, lng, updatedAt } | null, etaAt, pickupEtaAt, pickedUp }`.

- [ ] **Step 1: Update the tests**

In `server/__tests__/tripLocation.test.js`:

Line 93 becomes:

```js
    expect(body).toEqual({ location: null, etaAt: null, pickupEtaAt: null, pickedUp: false });
```

Replace the test `'once started, the host writes position and ETA; approved riders read them'` with:

```js
  test('once started, the host writes position and both ETAs; approved riders read them', async () => {
    if (guard()) return;
    expect((await req('POST', `/api/trips/${trip.id}/start`, host.id, {})).status).toBe(201);
    const write = await req('POST', `/api/trips/${trip.id}/location`, host.id, { ...VALID_COORDS, etaSeconds: 600, pickupEtaSeconds: 300 });
    expect(write.status).toBe(200);
    const body = await (await req('GET', `/api/trips/${trip.id}/location`, approvedPax.id)).json();
    expect(body.location).toMatchObject(VALID_COORDS);
    expect(new Date(body.etaAt).getTime()).toBeGreaterThan(Date.now() + 500 * 1000);
    expect(new Date(body.pickupEtaAt).getTime()).toBeGreaterThan(Date.now() + 200 * 1000);
    expect(body.pickedUp).toBe(false);

    const m = await prisma.match.findFirst({ where: { tripId: trip.id, passengerId: approvedPax.id } });
    expect((await req('POST', `/api/matches/${m.id}/picked-up`, host.id, {})).status).toBe(200);
    expect((await (await req('GET', `/api/trips/${trip.id}/location`, approvedPax.id)).json()).pickedUp).toBe(true);
    expect((await (await req('GET', `/api/trips/${trip.id}/location`, host.id)).json()).pickedUp).toBe(false);
  });
```

In `'a non-host cannot write; bad coordinates and ETA are refused'`, add before the closing `});`:

```js
    const badPickupEta = await req('POST', `/api/trips/${trip.id}/location`, host.id, { ...VALID_COORDS, pickupEtaSeconds: -1 });
    expect(badPickupEta.status).toBe(400);
    expect((await badPickupEta.json()).error).toBe('INVALID_ETA');
```

Replace the test `'a position older than 90 seconds is not served'` with:

```js
  test('a position up to 10 minutes old is served with its time; older is not', async () => {
    if (guard()) return;
    const setAge = (ms) =>
      prisma.tripRun.updateMany({ where: { tripId: trip.id }, data: { lastLocationUpdatedAt: new Date(Date.now() - ms) } });
    await setAge(5 * 60 * 1000);
    const paused = (await (await req('GET', `/api/trips/${trip.id}/location`, approvedPax.id)).json()).location;
    expect(paused).toMatchObject(VALID_COORDS);
    expect(Date.now() - Date.parse(paused.updatedAt)).toBeGreaterThan(4 * 60 * 1000);
    await setAge(11 * 60 * 1000);
    expect((await (await req('GET', `/api/trips/${trip.id}/location`, approvedPax.id)).json()).location).toBeNull();
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest server/__tests__/tripLocation.test.js --testTimeout=15000`
Expected: FAIL (no `pickupEtaAt`; `pickupEtaSeconds` rejected as `UNKNOWN_FIELD`; 5-minute point not served).

- [ ] **Step 3: Implement**

`server/validation/bodySchemas.js` line 103:

```js
  'trip.location': { ...LAT_LNG, etaSeconds: 'number', pickupEtaSeconds: 'number' },
```

`server/controllers/tripRunController.js`:
- add `const { isPickedUp } = require('../services/riderLocationRules');`
- replace `const STALE_LOCATION_MS = 90 * 1000; // ~3 missed 30 s ticks` with:

```js
// Older points are still served with their time, so riders see "paused"
// (the driver's phone stops in the background); after this they're dropped.
const PAUSED_LIMIT_MS = 10 * 60 * 1000;
const badEta = (v) => v != null && !(Number.isFinite(v) && v >= 0 && v <= MAX_ETA_SECONDS);
```

(move `const MAX_ETA_SECONDS = 6 * 60 * 60;` above it).
- in `updateLocation`: `const { lat, lng, etaSeconds, pickupEtaSeconds } = req.body;`, replace the `etaSeconds` check with

```js
  if (badEta(etaSeconds) || badEta(pickupEtaSeconds)) return res.status(400).json({ error: 'INVALID_ETA' });
```

and add to the `data` object:

```js
      ...(pickupEtaSeconds != null && { pickupEtaAt: new Date(now.getTime() + pickupEtaSeconds * 1000) }),
```

- replace `getLocation` with:

```js
async function getLocation(req, res) {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.id },
    select: { hostId: true, status: true, matches: { select: { passengerId: true, status: true, pickedUpAt: true } } },
  });
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (!canViewLocation(trip, req.user.id)) return res.status(403).json({ error: 'NOT_AUTHORIZED' });
  const run = await ongoingRun(req.params.id);
  if (!run) return res.json({ location: null, etaAt: null, pickupEtaAt: null, pickedUp: false });
  const recent = run.lastLocationUpdatedAt && Date.now() - run.lastLocationUpdatedAt.getTime() <= PAUSED_LIMIT_MS;
  const mine = trip.matches.find((m) => m.passengerId === req.user.id && m.status === 'APPROVED');
  res.json({
    location: recent ? { lat: run.lastKnownLat, lng: run.lastKnownLng, updatedAt: run.lastLocationUpdatedAt } : null,
    etaAt: run.etaAt,
    pickupEtaAt: run.pickupEtaAt,
    pickedUp: isPickedUp(mine?.pickedUpAt, run),
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest server/__tests__/tripLocation.test.js server/__tests__/strictBody.test.js --testTimeout=15000`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/tripRunController.js server/validation/bodySchemas.js server/__tests__/tripLocation.test.js
git commit -m "feat: driver location carries the pickup ETA and pickup status"
```

---

### Task 5: Navigation logic (pure) and the traffic-aware route

**Files:**
- Create: `src/lib/navigation.ts`
- Modify: `src/lib/directions.ts` (append `fetchNavRoute`)
- Create: `src/lib/__tests__/navigation.test.ts`

**Interfaces:**
- Produces (from `src/lib/navigation.ts`):
  - `interface NavStep { lat: number; lng: number; type: string; modifier: string | null; instruction: string; name: string }`
  - `interface NavRoute { line: LatLng[]; steps: NavStep[]; durationSeconds: number; distanceMeters: number; pickupSeconds: number | null }`
  - `type Arrow = 'left' | 'right' | 'slight-left' | 'slight-right' | 'sharp-left' | 'sharp-right' | 'straight' | 'uturn' | 'roundabout' | 'arrive'`
  - `parseNavRoute(data: unknown, hasPickup: boolean): NavRoute | null`
  - `nextManeuver(route: NavRoute, car: LatLng): { step: NavStep; meters: number } | null`
  - `isOffRoute(line: LatLng[], car: LatLng, limitMeters?: number): boolean`
  - `arrowFor(type: string, modifier: string | null): Arrow`
  - `distanceLabel(meters: number): string`
  - `googleMapsUrl(to: LatLng, via?: LatLng | null): string`, `wazeUrl(to: LatLng): string`
  - `OFF_ROUTE_M = 50`
- Produces (from `src/lib/directions.ts`): `fetchNavRoute(from: LatLng, pickup: LatLng | null, to: LatLng): Promise<NavRoute | null>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/navigation.test.ts
import { arrowFor, distanceLabel, googleMapsUrl, isOffRoute, nextManeuver, parseNavRoute, wazeUrl } from '@/lib/navigation';

// An L-shaped drive: east ~1.08 km along Quezon Ave, left, north ~1.1 km.
// The pickup is at the corner (end of leg 1).
const MAPBOX = {
  routes: [
    {
      distance: 2185,
      duration: 300,
      geometry: { coordinates: [[121.6, 13.9], [121.61, 13.9], [121.61, 13.91]] },
      legs: [
        {
          duration: 120,
          steps: [
            { name: 'Quezon Ave', maneuver: { type: 'depart', location: [121.6, 13.9], instruction: 'Head east on Quezon Ave' } },
            { name: '', maneuver: { type: 'arrive', location: [121.61, 13.9], instruction: 'You have arrived at your 1st destination' } },
          ],
        },
        {
          duration: 180,
          steps: [
            { name: 'Rizal St', maneuver: { type: 'turn', modifier: 'left', location: [121.61, 13.9], instruction: 'Turn left onto Rizal St' } },
            { name: '', maneuver: { type: 'arrive', location: [121.61, 13.91], instruction: 'You have arrived at your destination' } },
          ],
        },
      ],
    },
  ],
};

const route = parseNavRoute(MAPBOX, true)!;

test('parses the line, the steps (without departures) and both durations', () => {
  expect(route.line).toEqual([
    { lat: 13.9, lng: 121.6 },
    { lat: 13.9, lng: 121.61 },
    { lat: 13.91, lng: 121.61 },
  ]);
  expect(route.steps.map((s) => s.type)).toEqual(['arrive', 'turn', 'arrive']);
  expect(route.steps[1]).toMatchObject({ modifier: 'left', name: 'Rizal St', instruction: 'Turn left onto Rizal St' });
  expect(route).toMatchObject({ durationSeconds: 300, distanceMeters: 2185, pickupSeconds: 120 });
  expect(parseNavRoute(MAPBOX, false)!.pickupSeconds).toBeNull();
  expect(parseNavRoute({ routes: [] }, false)).toBeNull();
  expect(parseNavRoute(null, false)).toBeNull();
});

test('the next maneuver is the first one ahead of the car, with the distance along the road', () => {
  const before = nextManeuver(route, { lat: 13.9, lng: 121.605 })!;
  expect(before.step.type).toBe('arrive'); // the pickup at the corner
  expect(before.meters).toBeGreaterThan(500);
  expect(before.meters).toBeLessThan(580);
  const after = nextManeuver(route, { lat: 13.905, lng: 121.61 })!;
  expect(after.step.instruction).toBe('You have arrived at your destination');
  expect(after.meters).toBeGreaterThan(520);
  expect(after.meters).toBeLessThan(590);
  expect(nextManeuver(route, { lat: 13.91, lng: 121.61 })).toBeNull();
});

test('off route only beyond 50 m from the line', () => {
  expect(isOffRoute(route.line, { lat: 13.9, lng: 121.605 })).toBe(false);
  expect(isOffRoute(route.line, { lat: 13.9003, lng: 121.605 })).toBe(false); // ~33 m
  expect(isOffRoute(route.line, { lat: 13.902, lng: 121.605 })).toBe(true); // ~221 m
});

test('arrows, distances and hand-off links', () => {
  expect(arrowFor('turn', 'left')).toBe('left');
  expect(arrowFor('turn', 'slight right')).toBe('slight-right');
  expect(arrowFor('turn', 'sharp left')).toBe('sharp-left');
  expect(arrowFor('continue', 'uturn')).toBe('uturn');
  expect(arrowFor('roundabout', 'right')).toBe('roundabout');
  expect(arrowFor('rotary', null)).toBe('roundabout');
  expect(arrowFor('arrive', null)).toBe('arrive');
  expect(arrowFor('new name', 'straight')).toBe('straight');
  expect(arrowFor('merge', null)).toBe('straight');
  expect(distanceLabel(40)).toBe('40 m');
  expect(distanceLabel(287)).toBe('290 m');
  expect(distanceLabel(1234)).toBe('1.2 km');
  expect(googleMapsUrl({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })).toBe(
    'https://www.google.com/maps/dir/?api=1&destination=1,2&waypoints=3,4&travelmode=driving'
  );
  expect(googleMapsUrl({ lat: 1, lng: 2 })).toBe('https://www.google.com/maps/dir/?api=1&destination=1,2&travelmode=driving');
  expect(wazeUrl({ lat: 1, lng: 2 })).toBe('https://waze.com/ul?ll=1,2&navigate=yes');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest -c jest.web.config.mjs src/lib/__tests__/navigation.test.ts`
Expected: FAIL, cannot find module `@/lib/navigation`.

- [ ] **Step 3: Implement `src/lib/navigation.ts`**

```ts
// Turn guidance for the driver while a trip runs (live trip map). Pure: no
// browser or network; the hook in useDriverNavigation feeds it positions.
import type { LatLng } from '@/lib/directions';

export interface NavStep {
  lat: number;
  lng: number;
  type: string; // Mapbox maneuver type: turn, arrive, roundabout, …
  modifier: string | null; // left, slight right, uturn, …
  instruction: string;
  name: string; // the street after the maneuver ('' when unnamed)
}

export interface NavRoute {
  line: LatLng[];
  steps: NavStep[];
  durationSeconds: number;
  distanceMeters: number;
  pickupSeconds: number | null; // first leg, when the pickup is still ahead
}

export type Arrow =
  | 'left'
  | 'right'
  | 'slight-left'
  | 'slight-right'
  | 'sharp-left'
  | 'sharp-right'
  | 'straight'
  | 'uturn'
  | 'roundabout'
  | 'arrive';

export const OFF_ROUTE_M = 50;
const PASSED_M = 10; // a maneuver this close behind the car counts as done
const M_PER_DEG_LAT = 110540;

interface MapboxStep {
  name?: string;
  maneuver: { type: string; modifier?: string; location: [number, number]; instruction: string };
}

export function parseNavRoute(data: unknown, hasPickup: boolean): NavRoute | null {
  const route = (data as { routes?: Array<Record<string, unknown>> } | null)?.routes?.[0] as
    | { distance: number; duration: number; geometry?: { coordinates?: [number, number][] }; legs?: { duration: number; steps: MapboxStep[] }[] }
    | undefined;
  const coords = route?.geometry?.coordinates;
  if (!route || !coords || coords.length < 2) return null;
  const legs = route.legs ?? [];
  return {
    line: coords.map(([lng, lat]) => ({ lat, lng })),
    steps: legs
      .flatMap((l) => l.steps)
      .filter((s) => s.maneuver.type !== 'depart')
      .map((s) => ({
        lat: s.maneuver.location[1],
        lng: s.maneuver.location[0],
        type: s.maneuver.type,
        modifier: s.maneuver.modifier ?? null,
        instruction: s.maneuver.instruction,
        name: s.name ?? '',
      })),
    durationSeconds: Math.round(route.duration),
    distanceMeters: Math.round(route.distance),
    pickupSeconds: hasPickup && legs[0] ? Math.round(legs[0].duration) : null,
  };
}

// Flat-earth projection around p: good to a metre or two at city scale.
function toXY(q: LatLng, p: LatLng) {
  return { x: (q.lng - p.lng) * 111320 * Math.cos((p.lat * Math.PI) / 180), y: (q.lat - p.lat) * M_PER_DEG_LAT };
}

// How far along the line p's nearest point lies, and how far p is from it.
// ponytail: first-nearest segment; a route that doubles back on itself can
// match the wrong pass. Track the last matched segment if that ever shows up.
function project(line: LatLng[], p: LatLng): { along: number; meters: number } {
  let best = { along: 0, meters: Infinity };
  let walked = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = toXY(line[i], p);
    const b = toXY(line[i + 1], p);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / (len * len)));
    const meters = Math.hypot(a.x + t * dx, a.y + t * dy);
    if (meters < best.meters) best = { along: walked + t * len, meters };
    walked += len;
  }
  return best;
}

export function nextManeuver(route: NavRoute, car: LatLng): { step: NavStep; meters: number } | null {
  const carAlong = project(route.line, car).along;
  for (const step of route.steps) {
    const along = project(route.line, step).along;
    if (along > carAlong + PASSED_M) return { step, meters: Math.round(along - carAlong) };
  }
  return null;
}

export function isOffRoute(line: LatLng[], car: LatLng, limitMeters = OFF_ROUTE_M): boolean {
  return project(line, car).meters > limitMeters;
}

export function arrowFor(type: string, modifier: string | null): Arrow {
  if (type === 'arrive') return 'arrive';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return 'roundabout';
  switch (modifier) {
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    case 'slight left':
      return 'slight-left';
    case 'slight right':
      return 'slight-right';
    case 'sharp left':
      return 'sharp-left';
    case 'sharp right':
      return 'sharp-right';
    case 'uturn':
      return 'uturn';
    default:
      return 'straight';
  }
}

export function distanceLabel(meters: number): string {
  if (meters < 50) return `${Math.round(meters)} m`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

const ll = (p: LatLng) => `${p.lat},${p.lng}`;

export function googleMapsUrl(to: LatLng, via: LatLng | null = null): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${ll(to)}${via ? `&waypoints=${ll(via)}` : ''}&travelmode=driving`;
}

export function wazeUrl(to: LatLng): string {
  return `https://waze.com/ul?ll=${ll(to)}&navigate=yes`;
}
```

- [ ] **Step 4: Add `fetchNavRoute` to `src/lib/directions.ts`**

Add at the top: `import { parseNavRoute, type NavRoute } from '@/lib/navigation';` and append:

```ts
// The driver's live route (live trip map): traffic-aware, with turn steps,
// through the pickup while someone still waits there.
export async function fetchNavRoute(from: LatLng, pickup: LatLng | null, to: LatLng): Promise<NavRoute | null> {
  if (!TOKEN) return null;
  const coords = [from, ...(pickup ? [pickup] : []), to].map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?geometries=geojson&overview=full&steps=true&access_token=${TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return parseNavRoute(await res.json(), Boolean(pickup));
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run the test and types to verify they pass**

Run: `npx jest -c jest.web.config.mjs src/lib/__tests__/navigation.test.ts` then `npx tsc --noEmit -p .`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/navigation.ts src/lib/directions.ts src/lib/__tests__/navigation.test.ts
git commit -m "feat: turn guidance logic and the traffic-aware route"
```

---

### Task 6: Rider status helpers

**Files:**
- Modify: `src/lib/riderLocation.ts`
- Test: `src/lib/__tests__/riderLocation.test.ts`

**Interfaces:**
- Produces: `RiderLocation` gains `pickedUp?: boolean`; `riderStatusLine` shows `"<first name> · picked up"`; `interface DriverFeed { location: { lat: number; lng: number; updatedAt: string } | null; etaAt: string | null; pickupEtaAt: string | null; pickedUp: boolean }`; `riderTripLine(feed: DriverFeed, now: Date): string`; `PAUSED_AFTER_MS = 45_000`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/riderLocation.test.ts` (keep its existing imports; add `riderTripLine` and `clockLabel`):

```ts
import { riderTripLine } from '@/lib/riderLocation';
import { clockLabel } from '@/lib/tripRun';

describe('riderTripLine', () => {
  const now = new Date('2026-10-12T07:00:00+08:00');
  const at = (ms: number) => new Date(now.getTime() + ms).toISOString();
  const here = { lat: 13.9, lng: 121.6 };

  test('before pickup: minutes to the meeting point', () => {
    const feed = { location: { ...here, updatedAt: at(-5000) }, etaAt: at(20 * 60000), pickupEtaAt: at(6 * 60000), pickedUp: false };
    expect(riderTripLine(feed, now)).toBe('Driver is about 6 min from the meeting point');
    expect(riderTripLine({ ...feed, pickupEtaAt: at(30000) }, now)).toBe('Driver is almost at the meeting point');
  });

  test('after pickup: arrival at campus', () => {
    const feed = { location: { ...here, updatedAt: at(-5000) }, etaAt: at(20 * 60000), pickupEtaAt: at(6 * 60000), pickedUp: true };
    expect(riderTripLine(feed, now)).toBe(`On the way · arrive about ${clockLabel(at(20 * 60000))}`);
  });

  test('paused or missing driver location', () => {
    const feed = { location: { ...here, updatedAt: at(-2 * 60000) }, etaAt: null, pickupEtaAt: null, pickedUp: false };
    expect(riderTripLine(feed, now)).toBe('Driver’s location paused · last seen 2 min ago');
    expect(riderTripLine({ ...feed, location: null }, now)).toBe('Waiting for the driver’s location…');
  });
});

test('a picked-up rider reads as picked up', () => {
  const r = { matchId: 'm', passengerId: 'p', fullName: 'Maria Reyes', sharing: true, pickedUp: true, location: null, updatedAt: null, metersToPickup: null, atPickup: false };
  expect(riderStatusLine(r, new Date())).toBe('Maria · picked up');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest -c jest.web.config.mjs src/lib/__tests__/riderLocation.test.ts`
Expected: FAIL, `riderTripLine` not exported.

- [ ] **Step 3: Implement**

In `src/lib/riderLocation.ts`: update the header comment to `// Riders' locations for the driver until pickup (sub-project G, live trip map).`, add `import { clockLabel } from '@/lib/tripRun';`, add `pickedUp?: boolean;` to `RiderLocation` after `sharing`, and in `riderStatusLine` after the `name` line:

```ts
  if (r.pickedUp) return `${name} · picked up`;
```

Append:

```ts
// What a rider reads under the map while the trip runs (live trip map).
export interface DriverFeed {
  location: { lat: number; lng: number; updatedAt: string } | null;
  etaAt: string | null;
  pickupEtaAt: string | null;
  pickedUp: boolean;
}

export const PAUSED_AFTER_MS = 45 * 1000;

export function riderTripLine(feed: DriverFeed, now: Date): string {
  if (!feed.location) return 'Waiting for the driver’s location…';
  if (now.getTime() - new Date(feed.location.updatedAt).getTime() > PAUSED_AFTER_MS) {
    return `Driver’s location paused · last seen ${ago(feed.location.updatedAt, now)}`;
  }
  if (feed.pickedUp) return feed.etaAt ? `On the way · arrive about ${clockLabel(feed.etaAt)}` : 'On the way';
  if (!feed.pickupEtaAt) return 'Driver is on the way to the meeting point';
  const minutes = Math.ceil((new Date(feed.pickupEtaAt).getTime() - now.getTime()) / MIN_MS);
  return minutes <= 1 ? 'Driver is almost at the meeting point' : `Driver is about ${minutes} min from the meeting point`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest -c jest.web.config.mjs src/lib/__tests__/riderLocation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/riderLocation.ts src/lib/__tests__/riderLocation.test.ts
git commit -m "feat: rider status lines for the live trip map"
```

---

### Task 7: Theme-aware map and the rider's live view

**Files:**
- Modify: `src/components/RouteMapView.tsx` (map style line 251)
- Modify: `src/components/LiveRouteMap.tsx`

**Interfaces:**
- Consumes: `riderTripLine`, `DriverFeed` (Task 6).
- Produces: `LiveRouteMap` new optional props `ownLocation?: LatLng | null` (the driver's own position; when given, no polling and it is drawn as the car) and `onPickedUp?: (pickedUp: boolean) => void`; existing `routeWaypoints` is used for the live line when the caller passes it.

- [ ] **Step 1: Dark map style**

In `src/components/RouteMapView.tsx`, add above `export default function RouteMapView`:

```tsx
// The map follows the app's light/dark toggle (<html data-theme>), live.
function useDarkTheme(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.getAttribute('data-theme') === 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}
```

Inside the component, after `const mapRef = …`: `const dark = useDarkTheme();`. Replace `mapStyle="mapbox://styles/mapbox/light-v11"` with:

```tsx
          mapStyle={dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'}
```

Change the driver marker's `bg-blue-600` to `bg-[#800000]` so the car uses the app color, and the legend's "Driver" swatch (search `driverLocation &&` in the legend block) to the same color.

- [ ] **Step 2: Rider feed and driver's own position in `LiveRouteMap`**

Replace `src/components/LiveRouteMap.tsx` from the props interface down with:

```tsx
interface LiveRouteMapProps {
  tripId: string;
  origin: LatLng;
  destination: LatLng;
  meetingPoint: LatLng | null;
  routeWaypoints: LatLng[] | null;
  // Precomputed by the caller (passenger side, APPROVED match, active trip) —
  // this component only needs to know whether to poll, not why.
  canWatchDriverLocation: boolean;
  // Riders not yet picked up, for the driver (sub-project G, live trip map).
  riderLocations?: (LatLng & { label: string })[];
  // The driver's own position from their phone; drawn as the car, no polling.
  ownLocation?: LatLng | null;
  // The live ETA the driver's phone last sent (null when there's none).
  onEta?: (etaAt: string | null) => void;
  // Whether the driver marked this rider picked up (rider side).
  onPickedUp?: (pickedUp: boolean) => void;
}

export default function LiveRouteMap({
  tripId,
  origin,
  destination,
  meetingPoint,
  routeWaypoints,
  canWatchDriverLocation,
  riderLocations,
  ownLocation,
  onEta,
  onPickedUp,
}: LiveRouteMapProps) {
  const [feed, setFeed] = useState<DriverFeed | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!canWatchDriverLocation) {
      setFeed(null);
      return;
    }
    let cancelled = false;
    const poll = () => {
      apiFetch<DriverFeed>(`/api/trips/${tripId}/location`)
        .then((data) => {
          if (cancelled) return;
          setFeed(data);
          setNow(new Date());
          onEta?.(data.etaAt ?? null);
          onPickedUp?.(data.pickedUp);
        })
        .catch(() => {});
    };
    poll();
    const intervalId = setInterval(poll, DRIVER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, canWatchDriverLocation]);

  const car = ownLocation ?? (feed?.location ? { lat: feed.location.lat, lng: feed.location.lng } : null);
  return (
    <div className="space-y-2">
      <RouteMap
        origin={origin}
        destination={destination}
        meetingPoint={meetingPoint}
        routeWaypoints={routeWaypoints}
        driverLocation={car}
        riderLocations={riderLocations}
      />
      {canWatchDriverLocation && feed && (
        <p role="status" className="rsu-card py-2 text-sm font-semibold text-gray-900">
          {riderTripLine(feed, now)}
        </p>
      )}
    </div>
  );
}
```

At the top of the file: keep existing imports (`RouteMap`, `apiFetch`, `useEffect`, `useState`, `LatLng`), drop `LOCATION_POLL_INTERVAL_MS` if now unused, and add:

```tsx
import { riderTripLine, type DriverFeed } from '@/lib/riderLocation';

// Riders poll as often as the driver's phone sends (every 10 s).
const DRIVER_POLL_MS = 10 * 1000;
```

- [ ] **Step 3: Types**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/RouteMapView.tsx src/components/LiveRouteMap.tsx
git commit -m "feat: map follows the app theme; riders see the driver's progress"
```

---

### Task 8: Driver navigation hook, banner and Navigate

**Files:**
- Create: `src/lib/useDriverNavigation.ts`
- Create: `src/components/NavBanner.tsx`
- Create: `src/components/NavigateMenu.tsx`

**Interfaces:**
- Consumes: `fetchNavRoute` (Task 5), `nextManeuver`, `isOffRoute`, `arrowFor`, `distanceLabel`, `googleMapsUrl`, `wazeUrl`, `NavRoute`, `NavStep` (Task 5), `isNearCampus` from `@/lib/geoProximity`, `apiFetch` from `@/lib/api`.
- Produces:
  - `useDriverNavigation({ tripId, active, pickup, destination, onArrived }: { tripId: string; active: boolean; pickup: LatLng | null; destination: LatLng; onArrived: () => void }) → { position: LatLng | null; route: NavRoute | null; next: { step: NavStep; meters: number } | null; blocked: boolean }`
  - `<NavBanner next={…} />` (renders nothing when `next` is null)
  - `<NavigateMenu to={LatLng} via={LatLng | null} />`

- [ ] **Step 1: The hook**

```ts
// src/lib/useDriverNavigation.ts
'use client';

// The driver's phone while a trip runs (live trip map): follows GPS, keeps a
// traffic-aware route with turn steps, reroutes when off it, and sends the
// position with both ETAs every 10 s. Replaces sub-project B's 30 s loop.
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { fetchNavRoute, type LatLng } from '@/lib/directions';
import { isNearCampus } from '@/lib/geoProximity';
import { isOffRoute, nextManeuver, type NavRoute } from '@/lib/navigation';

const SEND_MS = 10 * 1000;
const REFRESH_MS = 2 * 60 * 1000;
const MIN_REROUTE_GAP_MS = 15 * 1000;
const OFF_ROUTE_FIXES = 2;

interface Options {
  tripId: string;
  active: boolean;
  pickup: LatLng | null; // meeting point while a rider still waits, else null
  destination: LatLng;
  onArrived: () => void;
}

export function useDriverNavigation({ tripId, active, pickup, destination, onArrived }: Options) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [blocked, setBlocked] = useState(false);
  const pos = useRef<LatLng | null>(null);
  const routeRef = useRef<{ route: NavRoute; at: number } | null>(null);
  const lastFetch = useRef(0);
  const offCount = useRef(0);
  const arrived = useRef(false);
  const pickupKey = pickup ? `${pickup.lat},${pickup.lng}` : '';

  const reroute = async () => {
    if (!pos.current) return;
    lastFetch.current = Date.now();
    const next = await fetchNavRoute(pos.current, pickup, destination);
    if (!next) return;
    routeRef.current = { route: next, at: Date.now() };
    offCount.current = 0;
    setRoute(next);
  };

  // GPS and the screen wake lock.
  useEffect(() => {
    if (!active || !('geolocation' in navigator)) return;
    let wakeLock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((lock) => {
      if (cancelled) lock.release().catch(() => {});
      else wakeLock = lock;
    }).catch(() => {});
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        pos.current = here;
        setBlocked(false);
        setPosition(here);
      },
      () => setBlocked(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(id);
      wakeLock?.release().catch(() => {});
    };
  }, [active]);

  // First route, off-route reroutes, and a new route when the pickup leg changes.
  useEffect(() => {
    if (!active || !position) return;
    if (!routeRef.current) {
      if (Date.now() - lastFetch.current > MIN_REROUTE_GAP_MS) void reroute();
      return;
    }
    offCount.current = isOffRoute(routeRef.current.route.line, position) ? offCount.current + 1 : 0;
    if (offCount.current >= OFF_ROUTE_FIXES && Date.now() - lastFetch.current > MIN_REROUTE_GAP_MS) void reroute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, position]);

  useEffect(() => {
    if (!active) return;
    routeRef.current = null; // forces a fresh route on the next fix
    void reroute();
    const id = setInterval(() => void reroute(), REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pickupKey]);

  // Position and ETAs to the server every 10 s; near campus ends the run.
  useEffect(() => {
    if (!active) return;
    const send = () => {
      const here = pos.current;
      if (!here) return;
      if (isNearCampus(here) && !arrived.current) {
        arrived.current = true;
        apiFetch(`/api/trips/${tripId}/arrived`, { method: 'POST', body: JSON.stringify({}) })
          .then(onArrived)
          .catch(() => {});
        return;
      }
      const r = routeRef.current;
      const elapsed = r ? Math.round((Date.now() - r.at) / 1000) : 0;
      const body = {
        ...here,
        ...(r && { etaSeconds: Math.max(0, r.route.durationSeconds - elapsed) }),
        ...(r?.route.pickupSeconds != null && { pickupEtaSeconds: Math.max(0, r.route.pickupSeconds - elapsed) }),
      };
      apiFetch(`/api/trips/${tripId}/location`, { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
    };
    const id = setInterval(send, SEND_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tripId]);

  const next = useMemo(() => (route && position ? nextManeuver(route, position) : null), [route, position]);
  return { position, route, next, blocked };
}
```

- [ ] **Step 2: The banner**

```tsx
// src/components/NavBanner.tsx
'use client';

import React from 'react';
import { FaArrowLeft, FaArrowRight, FaArrowUp, FaFlagCheckered, FaRedo, FaUndo } from 'react-icons/fa';
import { arrowFor, distanceLabel, type Arrow, type NavStep } from '@/lib/navigation';

const ICON: Record<Arrow, { Icon: React.ComponentType<{ className?: string }>; turn?: string }> = {
  left: { Icon: FaArrowLeft },
  right: { Icon: FaArrowRight },
  'slight-left': { Icon: FaArrowUp, turn: '-rotate-45' },
  'slight-right': { Icon: FaArrowUp, turn: 'rotate-45' },
  'sharp-left': { Icon: FaArrowLeft, turn: '-rotate-45' },
  'sharp-right': { Icon: FaArrowRight, turn: 'rotate-45' },
  straight: { Icon: FaArrowUp },
  uturn: { Icon: FaUndo },
  roundabout: { Icon: FaRedo },
  arrive: { Icon: FaFlagCheckered },
};

// The driver's next turn, in app colors, above the live map (live trip map).
export default function NavBanner({ next }: { next: { step: NavStep; meters: number } | null }) {
  if (!next) return null;
  const { Icon, turn } = ICON[arrowFor(next.step.type, next.step.modifier)];
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl bg-[color:var(--rsu-color-primary)] px-4 py-3 text-white shadow-md">
      <Icon className={`h-7 w-7 shrink-0 ${turn ?? ''}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-xl font-extrabold tabular-nums leading-tight">{distanceLabel(next.meters)}</p>
        <p className="truncate text-sm font-semibold opacity-90">{next.step.name || next.step.instruction}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: The Navigate menu**

```tsx
// src/components/NavigateMenu.tsx
'use client';

import React, { useState } from 'react';
import { FaDirections } from 'react-icons/fa';
import type { LatLng } from '@/lib/directions';
import { googleMapsUrl, wazeUrl } from '@/lib/navigation';

// Hands the drive to Google Maps or Waze for spoken directions. The trip page
// stops sending the position while it's in the background, so riders then see
// "paused" until the driver comes back.
export default function NavigateMenu({ to, via }: { to: LatLng; via: LatLng | null }) {
  const [open, setOpen] = useState(false);
  const next = via ?? to;
  return (
    <div className="space-y-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="rsu-btn-secondary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
        <FaDirections className="h-4 w-4" aria-hidden />
        Navigate
      </button>
      {open && (
        <div className="rsu-card space-y-2 p-3">
          <div className="grid grid-cols-2 gap-2">
            <a href={googleMapsUrl(to, via)} target="_blank" rel="noopener noreferrer" className="rsu-btn-primary px-3 py-2 text-center text-sm">
              Google Maps
            </a>
            <a href={wazeUrl(next)} target="_blank" rel="noopener noreferrer" className="rsu-btn-primary px-3 py-2 text-center text-sm">
              Waze
            </a>
          </div>
          <p className="text-xs text-gray-500">Riders see your car only while this page is open. Come back here after you turn.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Types**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/useDriverNavigation.ts src/components/NavBanner.tsx src/components/NavigateMenu.tsx
git commit -m "feat: driver navigation hook, next-turn banner and Navigate menu"
```

---

### Task 9: Riders cards during the run, and wiring the trip page

**Files:**
- Modify: `src/components/RidersNearbyCard.tsx`
- Modify: `src/components/RiderLocationCard.tsx`
- Modify: `src/app/auth/trips/[id]/TripDetailClient.tsx` (imports lines 17–28; state lines 151–159; the send effect lines 166–211; render lines 262–298)

**Interfaces:**
- Consumes: everything above.
- Produces: `RidersNearbyCard` props `{ tripId; departure; runOngoing: boolean; onRiders }`; `RiderLocationCard` props add `runOngoing: boolean; pickedUp: boolean`.

- [ ] **Step 1: `RidersNearbyCard` works during the run**

Change the props interface to add `runOngoing: boolean;`, the signature to `({ tripId, departure, runOngoing, onRiders })`, and:

```tsx
  const open = runOngoing || sharingState(departure, now).state === 'open';
  const [busy, setBusy] = useState<string | null>(null);
```

Turn the `load` function into a `useCallback` (`const load = useCallback(async () => { … }, [tripId, onRiders]);`, with the `cancelled` guard dropped) used by the polling effect, and add:

```tsx
  async function setPickedUp(matchId: string, pickedUp: boolean) {
    setBusy(matchId);
    try {
      await apiFetch(`/api/matches/${matchId}/picked-up`, { method: pickedUp ? 'POST' : 'DELETE', body: '{}' });
      await load();
    } catch {
      /* the next poll shows the real state */
    } finally {
      setBusy(null);
    }
  }
```

Render (replace the `<section>`):

```tsx
  return (
    <section aria-label={runOngoing ? 'Riders to pick up' : 'Riders before pickup'} className="rsu-card space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
        <FaUsers className="h-4 w-4 text-[color:var(--rsu-color-primary)]" aria-hidden />
        {runOngoing ? 'Riders to pick up' : 'Riders before pickup'}
      </h2>
      <ul className="space-y-2 text-sm text-gray-800">
        {riders.map((r) => (
          <li key={r.matchId} className="flex items-center justify-between gap-3">
            <span className={r.atPickup && !r.pickedUp ? 'font-semibold text-gray-900' : undefined}>{riderStatusLine(r, now)}</span>
            {runOngoing && (
              <button
                type="button"
                disabled={busy === r.matchId}
                onClick={() => setPickedUp(r.matchId, !r.pickedUp)}
                className={`${r.pickedUp ? 'rsu-btn-secondary' : 'rsu-btn-primary'} shrink-0 px-3 py-1.5 text-xs disabled:opacity-60`}
              >
                {r.pickedUp ? 'Undo' : 'Picked up'}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">
        Riders who turned sharing on appear on the map until you mark them picked up. Their positions are erased then, and when the trip ends.
      </p>
    </section>
  );
```

- [ ] **Step 2: `RiderLocationCard` keeps sending until pickup**

Add `runOngoing: boolean; pickedUp: boolean;` to the props and signature, and change:

```tsx
  const open = !pickedUp && (runOngoing || share.state === 'open');
```

Status text, before the `let status` chain's first `if`:

```tsx
  if (pickedUp) status = 'You’re in the car. Sharing has stopped for this trip.';
  else if (on && open) …
```

(turn the existing first `if` into `else if`). Change the heading to `Share my location with the driver until pickup` and the footnote to:

```tsx
        Only your driver sees it, from 15 minutes before departure until they mark you picked up. Only your latest position is
        kept, and it’s erased at pickup or when the trip ends.
```

- [ ] **Step 3: Wire `TripDetailClient`**

Imports: remove `getCurrentCoords, isNearCampus`, `LOCATION_POLL_INTERVAL_MS` and `fetchRoute` if no other use remains (check with `grep -n` in the file); add:

```tsx
import NavBanner from '@/components/NavBanner';
import NavigateMenu from '@/components/NavigateMenu';
import { useDriverNavigation } from '@/lib/useDriverNavigation';
import { distanceLabel } from '@/lib/navigation';
import { clockLabel } from '@/lib/tripRun';
```

State (replace lines 155–159):

```tsx
  // Sub-project G / live trip map: approved riders for the driver; pins for those not picked up.
  const [riders, setRiders] = useState<RiderLocation[] | null>(null);
  const showRiderPins = useCallback((list: RiderLocation[]) => setRiders(list), []);
  const riderPins = (riders ?? []).flatMap((r) => (r.location && !r.pickedUp ? [{ ...r.location, label: r.fullName }] : []));
  const [pickedUp, setPickedUp] = useState(false);
  const meetingPoint =
    trip.meetingPointLat != null && trip.meetingPointLng != null ? { lat: trip.meetingPointLat, lng: trip.meetingPointLng } : null;
  const pickupPoint = meetingPoint ?? { lat: trip.originLat, lng: trip.originLng };
  const approvedCount = trip.matches.filter((m) => m.status === 'APPROVED').length;
  const someoneWaiting = riders === null ? approvedCount > 0 : riders.some((r) => !r.pickedUp);
  const destination = { lat: trip.destinationLat, lng: trip.destinationLng };
```

Replace the whole send effect (the comment block starting `// The driver's phone while a run is ongoing (sub-project B)` through `}, [trip.id, isHost, runOngoing]);`, including `arrivedRef`) with:

```tsx
  // Live trip map: GPS, route, turn guidance and the 10 s position sends.
  const nav = useDriverNavigation({
    tripId: trip.id,
    active: isHost && runOngoing,
    pickup: someoneWaiting ? pickupPoint : null,
    destination,
    onArrived: () => router.refresh(),
  });
  const remainingMeters = nav.route?.distanceMeters ?? null;
```

Render: replace the `<LiveRouteMap … />` block and the two cards (lines 262–298) with:

```tsx
        {isHost && runOngoing && (
          <div className="space-y-2">
            <NavBanner next={nav.next} />
            {nav.blocked && (
              <p role="alert" className="text-sm text-red-600">Allow location for this site so the app can guide you and riders can see you.</p>
            )}
          </div>
        )}

        <LiveRouteMap
          tripId={trip.id}
          origin={{ lat: trip.originLat, lng: trip.originLng }}
          destination={destination}
          meetingPoint={meetingPoint}
          routeWaypoints={isHost && runOngoing && nav.route ? nav.route.line : trip.routeWaypoints}
          canWatchDriverLocation={canWatchDriverLocation}
          riderLocations={isHost ? riderPins : undefined}
          ownLocation={isHost && runOngoing ? nav.position : undefined}
          onEta={setLiveEtaAt}
          onPickedUp={setPickedUp}
        />

        {isHost && runOngoing && (
          <div className="rsu-card space-y-3">
            <p className="text-sm font-semibold text-gray-900">
              {someoneWaiting
                ? `Next: pick up at ${trip.meetingPointAddress ?? 'the start'}${
                    nav.route?.pickupSeconds != null ? ` · about ${Math.max(1, Math.round(nav.route.pickupSeconds / 60))} min` : ''
                  }`
                : `To campus${remainingMeters != null ? ` · ${distanceLabel(remainingMeters)}` : ''}${
                    nav.route ? ` · arrive about ${clockLabel(new Date(Date.now() + nav.route.durationSeconds * 1000))}` : ''
                  }`}
            </p>
            <NavigateMenu to={destination} via={someoneWaiting ? pickupPoint : null} />
          </div>
        )}

        {tripIsActive && (isHost || myActiveMatch?.status === 'APPROVED') && (
          <TripRunPanel
            tripId={trip.id}
            isHost={isHost}
            currentRun={trip.currentRun}
            nextDeparture={trip.nextDeparture}
            liveEtaAt={liveEtaAt}
          />
        )}

        {isHost && tripIsActive && (
          <RidersNearbyCard tripId={trip.id} departure={departureForSharing} runOngoing={runOngoing} onRiders={showRiderPins} />
        )}

        {!isHost && tripIsActive && myActiveMatch?.status === 'APPROVED' && (
          <RiderLocationCard
            tripId={trip.id}
            matchId={myActiveMatch.id}
            initialOn={trip.myLocationSharing === true}
            departure={departureForSharing}
            runOngoing={runOngoing}
            pickedUp={pickedUp}
          />
        )}
```

If `trip.meetingPointAddress` isn't on `TripDetail`, read its exact name from the interface (lines ~60–96) and use that field.

- [ ] **Step 4: Types and web tests**

Run: `npx tsc --noEmit -p .` then `npm run test:web`
Expected: no type errors; all web tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/RidersNearbyCard.tsx src/components/RiderLocationCard.tsx "src/app/auth/trips/[id]/TripDetailClient.tsx"
git commit -m "feat: live trip map on the trip page with pickup marking"
```

---

### Task 10: Postman, docs, full checks and the browser walk-through

**Files:**
- Modify: `postman/RideShareEU.postman_collection.json` (folder "23. Rider location")
- Modify: `AGENTS.md` (section G and a new section after I)

- [ ] **Step 1: Update Postman folder 23**

Run this one-off script (from the repo root) to replace the post-start requests:

```bash
node -e "
const fs=require('fs');const p='postman/RideShareEU.postman_collection.json';const c=JSON.parse(fs.readFileSync(p,'utf8'));
const find=(items)=>{for(const i of items){if(i.name&&i.name.startsWith('23.'))return i;if(i.item){const r=find(i.item);if(r)return r;}}};
const f=find(c.item);
const auth=(t)=>({type:'bearer',bearer:[{key:'token',value:'{{'+t+'}}',type:'string'}]});
const reqOf=(name,method,url,token,body,tests)=>({name,event:[{listen:'test',script:{type:'text/javascript',exec:tests}}],request:{method,header:[{key:'Content-Type',value:'application/json'}],url:'{{baseUrl}}'+url,auth:auth(token),body:{mode:'raw',raw:body}}});
const pos='{\n  \"lat\": 13.9632,\n  \"lng\": 121.5249\n}';
const i=f.item.findIndex(x=>x.name==='After the start positions are refused');
f.item.splice(i,2,
 reqOf('After the start the rider keeps sharing','POST','/api/trips/{{shareTripId}}/rider-location','passengerToken',pos,[\"pm.test('status is 200', () => pm.response.to.have.status(200));\"]),
 reqOf('Host sees the rider, not yet picked up','GET','/api/trips/{{shareTripId}}/rider-locations','hostToken','',[\"pm.test('status is 200', () => pm.response.to.have.status(200));\",\"pm.test('not picked up', () => pm.expect(pm.response.json().riders[0].pickedUp).to.eql(false));\"]),
 reqOf('The rider cannot mark themselves picked up','POST','/api/matches/{{shareMatchId}}/picked-up','passengerToken','{}',[\"pm.test('status is 403', () => pm.response.to.have.status(403));\"]),
 reqOf('Host marks the rider picked up','POST','/api/matches/{{shareMatchId}}/picked-up','hostToken','{}',[\"pm.test('status is 200', () => pm.response.to.have.status(200));\",\"pm.test('picked up', () => pm.expect(pm.response.json().pickedUp).to.eql(true));\"]),
 reqOf('After pickup positions are refused','POST','/api/trips/{{shareTripId}}/rider-location','passengerToken',pos,[\"pm.test('status is 409', () => pm.response.to.have.status(409));\",\"pm.test('PICKED_UP', () => pm.expect(pm.response.json().error).to.eql('PICKED_UP'));\"]),
 reqOf('The rider sees they are picked up','GET','/api/trips/{{shareTripId}}/location','passengerToken','',[\"pm.test('status is 200', () => pm.response.to.have.status(200));\",\"pm.test('pickedUp', () => pm.expect(pm.response.json().pickedUp).to.eql(true));\"])
);
fs.writeFileSync(p,JSON.stringify(c,null,'\t')+'\n');
"
```

Before running, open the folder's existing requests to confirm the token variable names (`hostToken`, `passengerToken`) and the request names match; adjust the script if they differ. Check the collection's original indentation (`head -3` of the file) and use the same in `JSON.stringify`. Then run `npm run seed:postman` and `npm run test:api` (API on :4000 running).
Expected: folder 23 passes.

- [ ] **Step 2: `AGENTS.md`**

In section **G**, change "Erased at Start Trip (`clearTripRiderLocations` in `startRun`)" to "Erased at pickup and at run end (`finishRun`; live trip map)". Add after section **I**:

```markdown
**Live trip map (done, designed in chat):** spec `docs/superpowers/specs/2026-10-11-live-trip-map-design.md`,
plan `docs/superpowers/plans/2026-10-11-live-trip-map.md`.
- Riders share after Start Trip until the driver taps **Picked up**
  (`POST`/`DELETE /api/matches/:id/picked-up`, host, ongoing run; 409
  `NO_ONGOING_RUN` / `NOT_APPROVED`). `Match.pickedUpAt` counts for a run when
  it's after `run.startedAt` (`isPickedUp`). After pickup 409 `PICKED_UP`.
- `POST /location` takes `pickupEtaSeconds` (`TripRun.pickupEtaAt`); `GET
  /location` returns `pickupEtaAt`, `pickedUp` and points up to 10 min old
  (riders see "paused" after 45 s).
- Web: `useDriverNavigation` (watchPosition, Mapbox `driving-traffic` with
  steps through the pickup, reroute > 50 m twice, every 2 min, sends every
  10 s), `NavBanner`, `NavigateMenu` (Google Maps / Waze), pure logic in
  `src/lib/navigation.ts`. The map uses `dark-v11` in dark mode.
- A web page can't use GPS in the background: in Google Maps/Waze or with
  the screen off, riders see the driver paused.
- Postman: folder "23. Rider location" covers pickup.
```

- [ ] **Step 3: Full test run**

Run: `npm run test:server` then `npm run test:web` then `npx tsc --noEmit -p .`
Expected: all pass (one skipped Linux-only shutdown test).

- [ ] **Step 4: Browser walk-through (local, preview)**

With `api` and `web` launch configs running and a local test driver + rider (throwaway rows, deleted afterwards), on `http://localhost:3000` only:
- Driver page, run started, geolocation overridden (DevTools sensors or `navigator.geolocation` stub) to a point on the route: banner shows arrow + distance; moving the stub 200 m off the route twice triggers one new Directions request (`read_network_requests` filtered by `directions/v5`).
- "Picked up" removes the rider's pin and flips to "Undo"; the next-stop card switches to "To campus" once nobody waits.
- Rider page: status line shows minutes to the meeting point, then "On the way · arrive about …" after pickup; setting the run's `lastLocationUpdatedAt` 2 minutes back shows "paused".
- Toggle the theme: the map switches to the dark style; phone width (375 px) has no horizontal scroll.

- [ ] **Step 5: Commit**

```bash
git add postman/RideShareEU.postman_collection.json AGENTS.md
git commit -m "docs: live trip map notes and Postman pickup checks"
```

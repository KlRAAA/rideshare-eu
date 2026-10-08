# Trip Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drivers start and end each day's run of a trip; while a run is ongoing riders see elapsed time, ETA and the driver's position, and nobody can cancel.

**Architecture:** A new `TripRun` table (one row per trip per Philippine day, created on Start). Pure start-window rules live in `server/services/tripRunRules.js`; database actions in `server/services/tripRunService.js`; the HTTP layer (start, end, arrived, location) in `server/controllers/tripRunController.js`. The trip page gets a `TripRunPanel` component and the driver's phone sends position and ETA while a run is ongoing.

**Tech Stack:** Express 5, Prisma 7 (PostgreSQL 17, `db push`), Next.js 16 / React 19, Jest 30, Mapbox Directions (`src/lib/directions.ts`).

**Spec:** `docs/superpowers/specs/2026-10-08-trip-lifecycle-design.md`

## Global Constraints

- Start window: from 30 minutes before to 2 hours after that day's departure, on a day the trip runs (Philippine time).
- Automatic end: an ongoing run ends 60 minutes after `plannedArrivalAt`.
- A run's day is the departure's Philippine calendar day (`phDateOnly`).
- Location is served only while a run is ongoing, to the host and APPROVED riders, and only if under 90 s old.
- Live ETA from the driver's phone: `etaSeconds` 0–21600.
- Every new write route has a `strictBody` schema (`strictBody.test.js` enforces it).
- Tests create and remove their own data (CI starts empty); `cleanup()` must delete `tripRun` rows before trips.
- Commits authored as `Xyrus <xyrusdimacali@gmail.com>`, no AI trailers.
- Back up before the schema change: `node scripts/backup-db.mjs` (dev) and with `DATABASE_URL` set to `rideshare_demo`.

---

### Task 1: Start-window rules (pure)

**Files:**
- Create: `server/services/tripRunRules.js`
- Test: `server/services/__tests__/tripRunRules.test.js`

**Interfaces:**
- Produces:
  - `departureOnDay(trip, day: Date) → Date | null` (day = PH date as `phDateOnly` gives it)
  - `startWindow(departure: Date) → { opensAt: Date, closesAt: Date }`
  - `plannedArrival(trip, departure: Date) → Date`
  - `startCheck(trip, now: Date, startedDays: Set<number>) → { departure, runDate } | { error, opensAt? }`
  - `nextDeparture(trip, now: Date) → { departure, opensAt, closesAt } | null`
  - constants `AUTO_END_AFTER_ARRIVAL_MS`

- [ ] **Step 1: Write the failing test**

```js
const { departureOnDay, startWindow, plannedArrival, startCheck, nextDeparture } = require('../tripRunRules');
const { phDateOnly } = require('../recurrenceMath');

// 2026-06-01T23:00Z is Tuesday 2 June, 7:00 AM in the Philippines.
const FIRST = new Date('2026-06-01T23:00:00Z');
const trip = (over = {}) => ({ status: 'OPEN', recurrenceType: 'ONE_TIME', customDays: [], departureTime: FIRST, durationSeconds: 1800, ...over });
const at = (iso) => new Date(iso);
const none = new Set();

describe('departureOnDay', () => {
  test('a one-time trip departs only on its own Philippine day', () => {
    expect(departureOnDay(trip(), phDateOnly(FIRST))).toEqual(FIRST);
    expect(departureOnDay(trip(), phDateOnly(at('2026-06-03T00:00:00Z')))).toBeNull();
  });
  test('a weekday trip departs at the same time on later weekdays, not on Saturday', () => {
    const t = trip({ recurrenceType: 'WEEKDAYS' });
    expect(departureOnDay(t, phDateOnly(at('2026-06-04T00:00:00Z')))).toEqual(at('2026-06-03T23:00:00Z')); // Thu 7 AM PH
    expect(departureOnDay(t, phDateOnly(at('2026-06-06T00:00:00Z')))).toBeNull(); // Saturday
  });
});

describe('startCheck', () => {
  test('opens 30 minutes before departure and closes 2 hours after', () => {
    expect(startCheck(trip(), at('2026-06-01T22:29:59Z'), none)).toMatchObject({ error: 'TOO_EARLY_TO_START', opensAt: at('2026-06-01T22:30:00Z') });
    expect(startCheck(trip(), at('2026-06-01T22:30:00Z'), none)).toEqual({ departure: FIRST, runDate: phDateOnly(FIRST) });
    expect(startCheck(trip(), at('2026-06-02T01:00:00Z'), none)).toEqual({ departure: FIRST, runDate: phDateOnly(FIRST) });
    expect(startCheck(trip(), at('2026-06-02T01:00:01Z'), none)).toEqual({ error: 'TOO_LATE_TO_START' });
  });
  test('refuses a day the trip does not run, a second start, and a trip that is not active', () => {
    expect(startCheck(trip(), at('2026-06-05T23:00:00Z'), none)).toEqual({ error: 'NOT_A_TRIP_DAY' });
    expect(startCheck(trip(), at('2026-06-01T23:00:00Z'), new Set([phDateOnly(FIRST).getTime()]))).toEqual({ error: 'ALREADY_STARTED' });
    expect(startCheck(trip({ status: 'CANCELLED' }), at('2026-06-01T23:00:00Z'), none)).toEqual({ error: 'TRIP_NOT_ACTIVE' });
  });
  test('a trip leaving at 11:50 PM can still be started at 12:30 AM, for the day it left', () => {
    const late = trip({ recurrenceType: 'DAILY', departureTime: at('2026-06-01T15:50:00Z') }); // 11:50 PM PH, 1 June
    expect(startCheck(late, at('2026-06-01T16:30:00Z'), none)).toEqual({
      departure: at('2026-06-01T15:50:00Z'),
      runDate: phDateOnly(at('2026-06-01T15:50:00Z')),
    });
  });
});

describe('plannedArrival and nextDeparture', () => {
  test('arrival is departure plus the route time, or departure when unknown', () => {
    expect(plannedArrival(trip(), FIRST)).toEqual(at('2026-06-01T23:30:00Z'));
    expect(plannedArrival(trip({ durationSeconds: null }), FIRST)).toEqual(FIRST);
  });
  test('the next departure whose start window has not closed', () => {
    const t = trip({ recurrenceType: 'DAILY' });
    expect(nextDeparture(t, at('2026-06-02T05:00:00Z'))).toEqual({
      departure: at('2026-06-02T23:00:00Z'),
      opensAt: at('2026-06-02T22:30:00Z'),
      closesAt: at('2026-06-03T01:00:00Z'),
    });
    expect(nextDeparture(trip(), at('2026-06-03T00:00:00Z'))).toBeNull();
  });
  test('startWindow is −30 min / +2 h', () => {
    expect(startWindow(FIRST)).toEqual({ opensAt: at('2026-06-01T22:30:00Z'), closesAt: at('2026-06-02T01:00:00Z') });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest server/services/__tests__/tripRunRules.test.js`
Expected: FAIL, "Cannot find module '../tripRunRules'"

- [ ] **Step 3: Write minimal implementation**

```js
// When a driver may start a day's run of a trip (sub-project B). Pure: no
// database. A run's day is its departure's Philippine calendar day; later
// departures of a recurring trip are the first departure plus whole days (the
// Philippines has no daylight saving), as in reminderService.
const { recurrenceRunsOnDay, phDateOnly } = require('./recurrenceMath');

const DAY_MS = 24 * 60 * 60 * 1000;
const START_EARLY_MS = 30 * 60 * 1000;
const START_LATE_MS = 2 * 60 * 60 * 1000;
const AUTO_END_AFTER_ARRIVAL_MS = 60 * 60 * 1000;
const ACTIVE = ['OPEN', 'FULL'];

function departureOnDay(trip, day) {
  const firstDay = phDateOnly(trip.departureTime);
  if (!recurrenceRunsOnDay(trip, firstDay, day)) return null;
  const days = Math.round((day - firstDay) / DAY_MS);
  return new Date(trip.departureTime.getTime() + days * DAY_MS);
}

function startWindow(departure) {
  return { opensAt: new Date(departure - START_EARLY_MS), closesAt: new Date(departure.getTime() + START_LATE_MS) };
}

function plannedArrival(trip, departure) {
  return new Date(departure.getTime() + (trip.durationSeconds ?? 0) * 1000);
}

function startCheck(trip, now, startedDays) {
  if (!ACTIVE.includes(trip.status)) return { error: 'TRIP_NOT_ACTIVE' };
  const today = phDateOnly(now);
  // Yesterday too: a departure just before midnight is still startable after it.
  for (const day of [today, new Date(today - DAY_MS)]) {
    const departure = departureOnDay(trip, day);
    if (!departure) continue;
    const { opensAt, closesAt } = startWindow(departure);
    if (now < opensAt || now > closesAt) continue;
    if (startedDays.has(day.getTime())) return { error: 'ALREADY_STARTED' };
    return { departure, runDate: day };
  }
  const todays = departureOnDay(trip, today);
  if (!todays) return { error: 'NOT_A_TRIP_DAY' };
  const { opensAt } = startWindow(todays);
  return now < opensAt ? { error: 'TOO_EARLY_TO_START', opensAt } : { error: 'TOO_LATE_TO_START' };
}

// For the trip page: the soonest departure that can still be started.
function nextDeparture(trip, now) {
  const today = phDateOnly(now);
  for (let i = -1; i <= 7; i++) {
    const departure = departureOnDay(trip, new Date(today.getTime() + i * DAY_MS));
    if (!departure) continue;
    const window = startWindow(departure);
    if (window.closesAt >= now) return { departure, ...window };
  }
  return null;
}

module.exports = { departureOnDay, startWindow, plannedArrival, startCheck, nextDeparture, AUTO_END_AFTER_ARRIVAL_MS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest server/services/__tests__/tripRunRules.test.js` — Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/tripRunRules.js server/services/__tests__/tripRunRules.test.js
git commit -m "feat: rules for when a trip run can start"
```

### Task 2: Schema for runs

**Files:**
- Modify: `prisma/schema.prisma` (add `RunStatus`, `RunEndReason`, `TripRun`, `Trip.runs`, `NotificationType.TRIP_STARTED`)
- Modify: `scripts/backupModels.cjs` (add `'tripRun'` after `'trip'`)
- Modify: `server/test-helpers/seed.js` (`cleanup` deletes runs first)
- Test: `server/__tests__/backupModels.test.js` (existing)

**Interfaces:**
- Produces: `prisma.tripRun` with fields from the spec; `Trip.runs TripRun[]`.

- [ ] **Step 1: Back up both databases**

```bash
node scripts/backup-db.mjs
DATABASE_URL=postgres://postgres:postgres@localhost:5432/rideshare_demo node scripts/backup-db.mjs
```

- [ ] **Step 2: Add the model** (additive only; moving the location fields is Task 4)

```prisma
enum RunStatus {
  ONGOING
  COMPLETED
}

enum RunEndReason {
  DRIVER
  AUTO
  ARRIVED
}

// One day's run of a trip, created when the driver taps Start Trip
// (sub-project B). A day nobody started has no row.
model TripRun {
  id                    String        @id @default(cuid())
  tripId                String
  trip                  Trip          @relation(fields: [tripId], references: [id])
  runDate               DateTime
  status                RunStatus     @default(ONGOING)
  startedAt             DateTime      @default(now())
  plannedArrivalAt      DateTime
  endedAt               DateTime?
  endReason             RunEndReason?
  lastKnownLat          Float?
  lastKnownLng          Float?
  lastLocationUpdatedAt DateTime?
  etaAt                 DateTime?
  createdAt             DateTime      @default(now())

  @@unique([tripId, runDate])
  @@index([status])
}
```

In `model Trip` add `runs TripRun[]`; in `enum NotificationType` add `TRIP_STARTED`.

- [ ] **Step 3: Run the backup test to see it fail**

Run: `npx prisma generate && npx jest server/__tests__/backupModels.test.js` — Expected: FAIL (tripRun missing from the list)

- [ ] **Step 4: List the table and clean it up in tests**

`scripts/backupModels.cjs`: insert `'tripRun',` after `'trip',`.
`server/test-helpers/seed.js` `cleanup`, before `prisma.trip.deleteMany`:

```js
  await prisma.tripRun.deleteMany({ where: { tripId: { in: bag.tripIds } } });
```

Apply the schema: `npx prisma db push` (dev), then with `DATABASE_URL` set to `rideshare_demo`.

- [ ] **Step 5: Verify and commit**

Run: `npx jest server/__tests__/backupModels.test.js` — Expected: PASS

```bash
git add prisma/schema.prisma scripts/backupModels.cjs server/test-helpers/seed.js
git commit -m "feat: trip run table"
```

### Task 3: Start, end, arrived, automatic end, cancel guard

**Files:**
- Create: `server/services/tripRunService.js`, `server/controllers/tripRunController.js`
- Modify: `server/routes/tripRoutes.js`, `server/validation/bodySchemas.js`, `server/controllers/tripController.js` (`cancelTrip`, `markCompleted`), `server/services/tripCompletionService.js` (`applyLazyCompletion`), `server/server.js` (cron)
- Test: `server/__tests__/tripRuns.test.js`

**Interfaces:**
- Consumes: `startCheck`, `plannedArrival`, `AUTO_END_AFTER_ARRIVAL_MS` (Task 1); `completeTrip(trip)`, `completeRecurringOccurrence(trip, runDate)` (tripCompletionService).
- Produces:
  - `startRun(tripId, userId, now?) → { status, body }`
  - `endRun(tripId, userId, reason: 'DRIVER'|'ARRIVED', now?) → { status, body }`
  - `finishRun(run, reason, now?) → Promise<void>`
  - `endOverdueRuns(now?) → Promise<number>`
  - `ongoingRun(tripId) → Promise<TripRun|null>`
  - Routes `POST /api/trips/:id/start|end|arrived`.

- [ ] **Step 1: Write the failing tests** (`server/__tests__/tripRuns.test.js`)

```js
require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');
const { endOverdueRuns } = require('../services/tripRunService');

let server;
let base;
let dbUp = false;
const bag = newBag();
const req = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? bearer(userId) : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeAll(async () => {
  try { await prisma.$queryRawUnsafe('SELECT 1'); dbUp = true; } catch { /* stays false */ }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  if (dbUp) await cleanup(bag);
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});
const guard = () => !dbUp;

// A trip departing in 10 minutes, so it can be started now.
async function seedTrip(over = {}) {
  const host = await makeUser(bag, { fullName: 'Run Host' });
  const rider = await makeUser(bag, { fullName: 'Run Rider' });
  const vehicle = await makeVehicle(bag, host.id);
  const trip = await makeTrip(bag, host.id, vehicle.id, {
    departureTime: new Date(Date.now() + 10 * 60 * 1000),
    durationSeconds: 1800,
    ...over,
  });
  const match = await makeMatch(bag, trip.id, rider.id, { status: 'APPROVED' });
  return { host, rider, trip, match };
}

describe('starting a run', () => {
  test('the host starts it, riders are told, a second start is refused', async () => {
    if (guard()) return;
    const { host, rider, trip } = await seedTrip();
    const res = await req('POST', `/api/trips/${trip.id}/start`, host.id, {});
    expect(res.status).toBe(201);
    expect((await res.json()).run.status).toBe('ONGOING');
    const told = await prisma.notification.findMany({ where: { userId: rider.id, type: 'TRIP_STARTED', relatedTripId: trip.id } });
    expect(told).toHaveLength(1);
    expect((await req('POST', `/api/trips/${trip.id}/start`, host.id, {})).status).toBe(409);
  });

  test('a rider cannot start it; a trip departing tomorrow is too early', async () => {
    if (guard()) return;
    const { rider, trip } = await seedTrip();
    expect((await req('POST', `/api/trips/${trip.id}/start`, rider.id, {})).status).toBe(403);
    const { host: h2, trip: later } = await seedTrip({ departureTime: new Date(Date.now() + 26 * 60 * 60 * 1000) });
    const res = await req('POST', `/api/trips/${later.id}/start`, h2.id, {});
    expect(res.status).toBe(409);
    expect(['TOO_EARLY_TO_START', 'NOT_A_TRIP_DAY']).toContain((await res.json()).error);
  });
});

describe('cancelling while a run is ongoing', () => {
  test('neither the host nor an approved rider can cancel', async () => {
    if (guard()) return;
    const { host, rider, trip } = await seedTrip();
    await req('POST', `/api/trips/${trip.id}/start`, host.id, {});
    for (const who of [host, rider]) {
      const res = await req('PATCH', `/api/trips/${trip.id}/cancel`, who.id, {});
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('TRIP_IN_PROGRESS');
    }
  });
});

describe('ending a run', () => {
  test('End Trip completes a one-time trip and its approved rider', async () => {
    if (guard()) return;
    const { host, trip, match } = await seedTrip();
    await req('POST', `/api/trips/${trip.id}/start`, host.id, {});
    expect((await req('POST', `/api/trips/${trip.id}/end`, host.id, {})).status).toBe(200);
    expect((await prisma.trip.findUnique({ where: { id: trip.id } })).status).toBe('COMPLETED');
    expect((await prisma.match.findUnique({ where: { id: match.id } })).status).toBe('COMPLETED');
    const run = await prisma.tripRun.findFirst({ where: { tripId: trip.id } });
    expect(run).toMatchObject({ status: 'COMPLETED', endReason: 'DRIVER' });
  });

  test('End Trip on a recurring trip keeps it open and the rider approved', async () => {
    if (guard()) return;
    const { host, trip, match } = await seedTrip({ recurrenceType: 'DAILY' });
    await req('POST', `/api/trips/${trip.id}/start`, host.id, {});
    expect((await req('POST', `/api/trips/${trip.id}/end`, host.id, {})).status).toBe(200);
    expect((await prisma.trip.findUnique({ where: { id: trip.id } })).status).toBe('OPEN');
    expect((await prisma.match.findUnique({ where: { id: match.id } })).status).toBe('APPROVED');
  });

  test('arriving near campus before the trip started does nothing (early-completion bug)', async () => {
    if (guard()) return;
    const { host, trip } = await seedTrip();
    const res = await req('POST', `/api/trips/${trip.id}/arrived`, host.id, {});
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('NO_ONGOING_RUN');
    expect((await prisma.trip.findUnique({ where: { id: trip.id } })).status).toBe('OPEN');
  });

  test('the background job ends only runs an hour past their planned arrival', async () => {
    if (guard()) return;
    const { host, trip } = await seedTrip();
    await req('POST', `/api/trips/${trip.id}/start`, host.id, {});
    const run = await prisma.tripRun.findFirst({ where: { tripId: trip.id } });
    await endOverdueRuns(new Date(run.plannedArrivalAt.getTime() + 59 * 60 * 1000));
    expect((await prisma.tripRun.findUnique({ where: { id: run.id } })).status).toBe('ONGOING');
    await endOverdueRuns(new Date(run.plannedArrivalAt.getTime() + 61 * 60 * 1000));
    expect((await prisma.tripRun.findUnique({ where: { id: run.id } }))).toMatchObject({ status: 'COMPLETED', endReason: 'AUTO' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest server/__tests__/tripRuns.test.js` — Expected: FAIL (404 on `/start`; module not found for `tripRunService`)

- [ ] **Step 3: Implement the service** (`server/services/tripRunService.js`)

```js
// Starting and ending a day's run of a trip (sub-project B).
const prisma = require('../config/db');
const { decryptTripFields } = require('./encryptionService');
const { phDateOnly } = require('./recurrenceMath');
const { startCheck, plannedArrival, AUTO_END_AFTER_ARRIVAL_MS } = require('./tripRunRules');
const { completeTrip, completeRecurringOccurrence } = require('./tripCompletionService');

const DAY_MS = 24 * 60 * 60 * 1000;

function ongoingRun(tripId) {
  return prisma.tripRun.findFirst({ where: { tripId, status: 'ONGOING' } });
}

async function startRun(tripId, userId, now = new Date()) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { matches: { where: { status: 'APPROVED' } } } });
  if (!trip) return { status: 404, body: { error: 'TRIP_NOT_FOUND' } };
  if (trip.hostId !== userId) return { status: 403, body: { error: 'NOT_AUTHORIZED' } };

  const today = phDateOnly(now);
  const existing = await prisma.tripRun.findMany({
    where: { tripId, runDate: { in: [today, new Date(today - DAY_MS)] } },
    select: { runDate: true },
  });
  const check = startCheck(trip, now, new Set(existing.map((r) => r.runDate.getTime())));
  if (check.error) return { status: 409, body: check };

  let run;
  try {
    run = await prisma.tripRun.create({
      data: { tripId, runDate: check.runDate, startedAt: now, plannedArrivalAt: plannedArrival(trip, check.departure) },
    });
  } catch (err) {
    if (err.code === 'P2002') return { status: 409, body: { error: 'ALREADY_STARTED' } };
    throw err;
  }
  const { destinationAddress } = decryptTripFields(trip);
  if (trip.matches.length > 0) {
    await prisma.notification.createMany({
      data: trip.matches.map((m) => ({
        userId: m.passengerId,
        type: 'TRIP_STARTED',
        message: `Your driver has started the trip to ${destinationAddress}.`,
        relatedTripId: tripId,
      })),
    });
  }
  return { status: 201, body: { run } };
}

// Ends the run once (a second caller finds nothing to update), then completes
// the trip as before: the whole trip for one-time trips, that day for
// recurring ones.
async function finishRun(run, reason, now = new Date()) {
  const { count } = await prisma.tripRun.updateMany({
    where: { id: run.id, status: 'ONGOING' },
    data: { status: 'COMPLETED', endedAt: now, endReason: reason },
  });
  if (count === 0) return;
  const trip = await prisma.trip.findUnique({ where: { id: run.tripId }, include: { matches: true } });
  if (!trip) return;
  if (trip.recurrenceType === 'ONE_TIME') await completeTrip(trip);
  else await completeRecurringOccurrence(trip, run.runDate);
}

async function endRun(tripId, userId, reason, now = new Date()) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { hostId: true } });
  if (!trip) return { status: 404, body: { error: 'TRIP_NOT_FOUND' } };
  if (trip.hostId !== userId) return { status: 403, body: { error: 'NOT_AUTHORIZED' } };
  const run = await ongoingRun(tripId);
  if (!run) return { status: 409, body: { error: 'NO_ONGOING_RUN' } };
  await finishRun(run, reason, now);
  return { status: 200, body: { status: 'RUN_ENDED' } };
}

async function endOverdueRuns(now = new Date()) {
  const overdue = await prisma.tripRun.findMany({
    where: { status: 'ONGOING', plannedArrivalAt: { lt: new Date(now - AUTO_END_AFTER_ARRIVAL_MS) } },
  });
  for (const run of overdue) await finishRun(run, 'AUTO', now);
  return overdue.length;
}

module.exports = { ongoingRun, startRun, finishRun, endRun, endOverdueRuns };
```

- [ ] **Step 4: Controller, routes, schemas** 

`server/controllers/tripRunController.js`:

```js
const { startRun, endRun } = require('../services/tripRunService');

const reply = (res, { status, body }) => res.status(status).json(body);

async function start(req, res) {
  return reply(res, await startRun(req.params.id, req.user.id));
}
async function end(req, res) {
  return reply(res, await endRun(req.params.id, req.user.id, 'DRIVER'));
}
// Called by the driver's phone near campus. Only an ongoing run can end this
// way, so it can never complete a trip that hasn't started.
async function arrived(req, res) {
  return reply(res, await endRun(req.params.id, req.user.id, 'ARRIVED'));
}

module.exports = { start, end, arrived };
```

`server/routes/tripRoutes.js` (after the `/complete` line):

```js
router.post('/:id/start', strictBody('trip.start'), start); // host: begin today's run
router.post('/:id/end', strictBody('trip.end'), end); // host: end the ongoing run
router.post('/:id/arrived', strictBody('trip.arrived'), arrived); // host's phone near campus, ongoing run only
```

with `const { start, end, arrived } = require('../controllers/tripRunController');` at the top.

`server/validation/bodySchemas.js` next to `'trip.complete': NONE,`:

```js
  'trip.start': NONE,
  'trip.end': NONE,
  'trip.arrived': NONE,
```

- [ ] **Step 5: Cancel guard, manual complete, lazy completion, cron**

`tripController.cancelTrip`, after the CANCELLED/COMPLETED check:

```js
  if (await ongoingRun(trip.id)) return res.status(409).json({ error: 'TRIP_IN_PROGRESS' });
```

`tripController.markCompleted`, before `completeTrip(id)`:

```js
  const run = await ongoingRun(id);
  if (run) {
    await finishRun(run, 'DRIVER');
    return res.json({ trip: await prisma.trip.findUnique({ where: { id } }) });
  }
```

(import `{ ongoingRun, finishRun }` from `../services/tripRunService`).

`tripCompletionService.applyLazyCompletion`, at the top of the function:

```js
  // A started run ends through End Trip or the overdue-run job, never here:
  // otherwise a trip that left late would complete while still on the road.
  const ids = trips.map((t) => t.id);
  const onRoad = new Set(
    (await prisma.tripRun.findMany({ where: { tripId: { in: ids }, status: 'ONGOING' }, select: { tripId: true } })).map((r) => r.tripId)
  );
```

and `if (onRoad.has(t.id)) continue;` as the loop's first line.

`server/server.js`, inside the 5-minute `cron.schedule` callback:

```js
    endOverdueRuns().catch((err) => console.error(`[trip runs] auto-end failed: ${err.message}`));
```

- [ ] **Step 6: Run the tests**

Run: `npx jest server/__tests__/tripRuns.test.js server/__tests__/strictBody.test.js server/__tests__/recurringOccurrence.test.js` — Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/services/tripRunService.js server/controllers/tripRunController.js server/routes/tripRoutes.js server/validation/bodySchemas.js server/controllers/tripController.js server/services/tripCompletionService.js server/server.js server/__tests__/tripRuns.test.js
git commit -m "feat: start and end trip runs, and refuse cancelling during one"
```

### Task 4: Location belongs to the run

**Files:**
- Modify: `prisma/schema.prisma` (remove `Trip.lastKnownLat/Lng/lastLocationUpdatedAt`, `Preference.liveLocationSharing`)
- Move: `updateLocation`, `getLocation` from `server/controllers/tripController.js` to `server/controllers/tripRunController.js`
- Modify: `server/routes/tripRoutes.js`, `server/validation/bodySchemas.js` (`trip.location` gains `etaSeconds: 'number'`; `preference.update` loses `liveLocationSharing`), `server/controllers/preferenceController.js`, `server/services/accountDeletionService.js`
- Rewrite: `server/__tests__/tripLocation.test.js`
- Modify: `server/__tests__/crossUserAccess.test.js`, `server/__tests__/genderChange.test.js`, `server/__tests__/preferencesAuth.test.js` (drop `liveLocationSharing`)

**Interfaces:**
- Consumes: `ongoingRun` (Task 3).
- Produces: `POST /api/trips/:id/location { lat, lng, etaSeconds? }` → `{ ok: true }`; `GET` → `{ location: {lat,lng,updatedAt} | null, etaAt: string | null }`.

- [ ] **Step 1: Rewrite the location test** (`tripLocation.test.js`): same users as today (host, approved, pending, outsider, approved-on-another-trip); the trip departs in 10 minutes; no preference setup. Cases:

```js
test('writing before the run starts → 409 NO_ONGOING_RUN', async () => {
  if (guard()) return;
  const res = await req('POST', `/api/trips/${trip.id}/location`, host.id, VALID_COORDS);
  expect(res.status).toBe(409);
  expect((await res.json()).error).toBe('NO_ONGOING_RUN');
});

test('once started, the host writes position and ETA; approved riders read them', async () => {
  if (guard()) return;
  expect((await req('POST', `/api/trips/${trip.id}/start`, host.id, {})).status).toBe(201);
  expect((await req('POST', `/api/trips/${trip.id}/location`, host.id, { ...VALID_COORDS, etaSeconds: 600 })).status).toBe(200);
  const body = await (await req('GET', `/api/trips/${trip.id}/location`, approvedPax.id)).json();
  expect(body.location).toMatchObject(VALID_COORDS);
  expect(new Date(body.etaAt).getTime()).toBeGreaterThan(Date.now() + 500 * 1000);
});

test.each([['pending rider', () => pendingPax], ['outsider', () => outsider], ['rider on another trip', () => otherTripApprovedPax]])(
  '%s → 403', async (_l, who) => {
    if (guard()) return;
    expect((await req('GET', `/api/trips/${trip.id}/location`, who().id)).status).toBe(403);
  }
);

test('a non-host cannot write; bad coordinates and ETA are refused', async () => {
  if (guard()) return;
  expect((await req('POST', `/api/trips/${trip.id}/location`, approvedPax.id, VALID_COORDS)).status).toBe(403);
  expect((await req('POST', `/api/trips/${trip.id}/location`, host.id, { lat: 91, lng: 0 })).status).toBe(400);
  expect((await req('POST', `/api/trips/${trip.id}/location`, host.id, { ...VALID_COORDS, etaSeconds: -5 })).status).toBe(400);
});

test('a position older than 90 seconds is not served', async () => {
  if (guard()) return;
  await prisma.tripRun.updateMany({ where: { tripId: trip.id }, data: { lastLocationUpdatedAt: new Date(Date.now() - 5 * 60 * 1000) } });
  expect((await (await req('GET', `/api/trips/${trip.id}/location`, approvedPax.id)).json()).location).toBeNull();
});

test('after the run ends nothing is served', async () => {
  if (guard()) return;
  await req('POST', `/api/trips/${trip.id}/end`, host.id, {});
  expect((await (await req('GET', `/api/trips/${trip.id}/location`, host.id)).json()).location).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails** — `npx jest server/__tests__/tripLocation.test.js`; Expected: FAIL (writes still gated on the preference; no `etaAt`).

- [ ] **Step 3: Move and change the handlers** into `tripRunController.js`:

```js
const prisma = require('../config/db');
const { ongoingRun } = require('../services/tripRunService');

const STALE_LOCATION_MS = 90 * 1000; // ~3 missed 30 s ticks
const MAX_ETA_SECONDS = 6 * 60 * 60;

async function updateLocation(req, res) {
  const trip = await prisma.trip.findUnique({ where: { id: req.params.id }, select: { hostId: true } });
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (trip.hostId !== req.user.id) return res.status(403).json({ error: 'NOT_AUTHORIZED' });
  const run = await ongoingRun(req.params.id);
  if (!run) return res.status(409).json({ error: 'NO_ONGOING_RUN' });

  const { lat, lng, etaSeconds } = req.body;
  // Number(null) is 0, so missing values are checked first.
  if (lat == null || lng == null) return res.status(400).json({ error: 'INVALID_COORDINATES' });
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
    return res.status(400).json({ error: 'INVALID_COORDINATES' });
  }
  if (etaSeconds != null && !(Number.isFinite(etaSeconds) && etaSeconds >= 0 && etaSeconds <= MAX_ETA_SECONDS)) {
    return res.status(400).json({ error: 'INVALID_ETA' });
  }
  const now = new Date();
  await prisma.tripRun.update({
    where: { id: run.id },
    data: {
      lastKnownLat: latNum,
      lastKnownLng: lngNum,
      lastLocationUpdatedAt: now,
      ...(etaSeconds != null && { etaAt: new Date(now.getTime() + etaSeconds * 1000) }),
    },
  });
  res.json({ ok: true });
}

function canViewLocation(trip, userId) {
  return userId === trip.hostId || trip.matches.some((m) => m.passengerId === userId && m.status === 'APPROVED');
}

async function getLocation(req, res) {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.id },
    select: { hostId: true, status: true, matches: { select: { passengerId: true, status: true } } },
  });
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (!canViewLocation(trip, req.user.id)) return res.status(403).json({ error: 'NOT_AUTHORIZED' });
  const run = await ongoingRun(req.params.id);
  if (!run) return res.json({ location: null, etaAt: null });
  const fresh = run.lastLocationUpdatedAt && Date.now() - run.lastLocationUpdatedAt.getTime() <= STALE_LOCATION_MS;
  res.json({
    location: fresh ? { lat: run.lastKnownLat, lng: run.lastKnownLng, updatedAt: run.lastLocationUpdatedAt } : null,
    etaAt: run.etaAt,
  });
}
```

Export them; point the two routes at `tripRunController`; delete the old handlers, `LOCATION_SHAREABLE_STATUSES`, `STALE_LOCATION_MS` and `canViewLocation` from `tripController.js` (and from its exports). In `bodySchemas.js`: `'trip.location': { ...LAT_LNG, etaSeconds: 'number' }`; remove `liveLocationSharing` from the preferences schema.

- [ ] **Step 4: Remove the old fields**

`prisma/schema.prisma`: delete `lastKnownLat`, `lastKnownLng`, `lastLocationUpdatedAt` from `Trip` (and their comment) and `liveLocationSharing` from `Preference`. `preferenceController.js`: drop it from the default object, the destructuring, `update` and `create`. `accountDeletionService.js`: drop the three fields from the trip update and add, in the same transaction after the loop:

```js
    await tx.tripRun.updateMany({
      where: { trip: { hostId: userId } },
      data: { lastKnownLat: null, lastKnownLng: null, lastLocationUpdatedAt: null, etaAt: null },
    });
```

Tests: remove `liveLocationSharing` from the bodies in `crossUserAccess.test.js` (lines 77, 118 use `flexWindowMinutes` instead; line 191 drops `lastKnownLat: null`; line 194 asserts `pref.flexWindowMinutes` instead), `genderChange.test.js` (prefBody) and `preferencesAuth.test.js`.

Apply: `npx prisma db push` on dev and demo (`--accept-data-loss` is needed for the dropped columns; they only held transient positions and a toggle).

- [ ] **Step 5: Run the tests**

Run: `npx jest server/__tests__/tripLocation.test.js server/__tests__/crossUserAccess.test.js server/__tests__/genderChange.test.js server/__tests__/preferencesAuth.test.js server/__tests__/accountDeletion.test.js server/__tests__/strictBody.test.js` — Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A prisma server
git commit -m "feat: share the driver's location only during a started run"
```

### Task 5: Run state in the trip APIs

**Files:**
- Modify: `server/controllers/tripController.js` (`getById`, `listMine`)
- Test: add to `server/__tests__/tripRuns.test.js`

**Interfaces:**
- Consumes: `nextDeparture`, `plannedArrival` (Task 1).
- Produces: `GET /api/trips/:id` adds `currentRun: { status, startedAt, plannedArrivalAt, etaAt } | null` and `nextDeparture: { departure, opensAt, closesAt, plannedArrivalAt } | null`; `GET /api/trips/mine` adds `inProgress: boolean` to hosted and joined trips.

- [ ] **Step 1: Failing test**

```js
describe('run state in the trip APIs', () => {
  test('trip details show the next departure, then the ongoing run; My Trips flags it', async () => {
    if (guard()) return;
    const { host, rider, trip } = await seedTrip();
    let detail = (await (await req('GET', `/api/trips/${trip.id}`, rider.id)).json()).trip;
    expect(detail.currentRun).toBeNull();
    expect(new Date(detail.nextDeparture.opensAt).getTime()).toBeLessThan(Date.now());
    await req('POST', `/api/trips/${trip.id}/start`, host.id, {});
    detail = (await (await req('GET', `/api/trips/${trip.id}`, rider.id)).json()).trip;
    expect(detail.currentRun.status).toBe('ONGOING');
    const mine = await (await req('GET', '/api/trips/mine', rider.id)).json();
    expect(mine.joined.find((j) => j.trip.id === trip.id).trip.inProgress).toBe(true);
  });
});
```

(Check the actual `joined` shape in `listMine` before asserting; adjust the path to the trip object it returns.)

- [ ] **Step 2: Run to fail** — `npx jest server/__tests__/tripRuns.test.js -t "run state"`.

- [ ] **Step 3: Implement**

In `getById`, include `runs: { orderBy: { startedAt: 'desc' }, take: 1 }` in the query, and before `res.json`:

```js
  const [latestRun] = tripRaw.runs;
  const today = phDateOnly(new Date());
  trip.currentRun =
    latestRun && (latestRun.status === 'ONGOING' || latestRun.runDate.getTime() === today.getTime())
      ? { status: latestRun.status, startedAt: latestRun.startedAt, plannedArrivalAt: latestRun.plannedArrivalAt, etaAt: latestRun.etaAt }
      : null;
  delete trip.runs;
  const next = ['OPEN', 'FULL'].includes(trip.status) ? nextDeparture(tripRaw, new Date()) : null;
  trip.nextDeparture = next && { ...next, plannedArrivalAt: plannedArrival(tripRaw, next.departure) };
```

In `listMine`, include `runs: { where: { status: 'ONGOING' }, select: { id: true } }` on hosted trips and on the joined `trip` include, and map each to `inProgress: t.runs.length > 0` (dropping `runs`) where the response objects are built.

- [ ] **Step 4: Run** — same command; Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: show the next departure and an ongoing run in trip details"`

### Task 6: UI labels (pure)

**Files:**
- Create: `src/lib/tripRun.ts`
- Test: `src/lib/__tests__/tripRun.test.ts`

**Interfaces:**
- Produces: `elapsedLabel(startedAt: string|Date, now: Date) → string`; `clockLabel(at: string|Date) → string` (Philippine time, e.g. "7:42 AM").

- [ ] **Step 1: Failing test**

```ts
import { describe, test, expect } from '@jest/globals';
import { elapsedLabel, clockLabel } from '../tripRun';

describe('trip run labels', () => {
  test('elapsed time in minutes, then hours and minutes', () => {
    const start = new Date('2026-06-01T23:00:00Z');
    expect(elapsedLabel(start, new Date('2026-06-01T23:00:20Z'))).toBe('just started');
    expect(elapsedLabel(start, new Date('2026-06-01T23:14:30Z'))).toBe('14 min');
    expect(elapsedLabel(start, new Date('2026-06-02T00:05:00Z'))).toBe('1 h 5 min');
  });
  test('clock times are shown in Philippine time', () => {
    expect(clockLabel('2026-06-01T23:42:00Z')).toBe('7:42 AM');
  });
});
```

- [ ] **Step 2: Run to fail** — `npx jest -c jest.web.config.mjs src/lib/__tests__/tripRun.test.ts`.

- [ ] **Step 3: Implement**

```ts
// Labels for a trip run on the trip page.
export function elapsedLabel(startedAt: string | Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 60000);
  if (minutes < 1) return 'just started';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function clockLabel(at: string | Date): string {
  return new Date(at).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
}
```

- [ ] **Step 4: Run** — PASS. **Step 5: Commit** — `git commit -m "feat: elapsed and arrival labels for trip runs"`

### Task 7: Trip page, profile, notifications, lists

**Files:**
- Create: `src/components/TripRunPanel.tsx`
- Modify: `src/app/auth/trips/[id]/TripDetailClient.tsx`, `src/app/auth/trips/[id]/page.tsx`, `src/components/LiveRouteMap.tsx`, `src/app/auth/profile/ProfileClient.tsx`, `src/app/auth/notifications/NotificationsClient.tsx`, `src/lib/notificationLink.ts`, `src/app/auth/trips/TripsListClient.tsx`, `src/app/auth/dashboard/page.tsx` (and its trip card)

**Interfaces:**
- Consumes: `currentRun`, `nextDeparture`, `inProgress` (Task 5); `elapsedLabel`, `clockLabel` (Task 6); `POST start|end|arrived|location` (Tasks 3–4).

- [ ] **Step 1: `TripRunPanel`** — props `{ tripId, isHost, currentRun, nextDeparture, liveEtaAt }`. Renders:
  - not ongoing, host, `nextDeparture` window open now → **Start Trip** (calls `POST /start`, then `router.refresh()`; shows the server message on error);
  - not ongoing, host, window not open → "You can start this trip from {clockLabel(opensAt)}";
  - not ongoing, rider → "Arrives about {clockLabel(nextDeparture.plannedArrivalAt)}";
  - ongoing (both) → a highlighted banner "Trip in progress · {elapsedLabel}" (re-rendered every 30 s with a `setInterval`), "Arrive about {clockLabel(liveEtaAt ?? currentRun.etaAt ?? currentRun.plannedArrivalAt)}";
  - ongoing, host → **End Trip** (`window.confirm('End this trip? Riders will be asked to rate it.')`, then `POST /end`, `router.refresh()`) and "Keep this page open so your riders can see where you are."

- [ ] **Step 2: Driver phone while ongoing** (in `TripDetailClient`): replace the two `liveLocationSharing` effects with one effect, active when `isHost && currentRun?.status === 'ONGOING'`:
  - every `LOCATION_POLL_INTERVAL_MS`: `getCurrentCoords()`; every 4th tick (2 min) also `fetchRoute(coords, destination)` → `etaSeconds = route.durationSeconds`; `POST /location { lat, lng, etaSeconds? }` (errors ignored);
  - on the first fix and every tick: `haversineMeters(coords, MSEUF_LUCENA) < CAMPUS_RADIUS` → `POST /arrived` then `router.refresh()` (reuse the radius `checkCampusProximity` uses);
  - `navigator.wakeLock?.request('screen')` on start, released on cleanup; failures ignored.
  Remove the `liveLocationSharing` prop and the preference fetch in `page.tsx`.

- [ ] **Step 3: Rider view** — `canWatchDriverLocation = !isHost && myActiveMatch?.status === 'APPROVED' && currentRun?.status === 'ONGOING'`. `LiveRouteMap` gains `onEta?: (etaAt: string | null) => void`, called with the poll's `etaAt`; `TripDetailClient` keeps it in state and passes it to `TripRunPanel` as `liveEtaAt`.

- [ ] **Step 4: Hide cancel and manual complete while ongoing** — `canCancel` and the "Mark Trip as Completed" button add `&& currentRun?.status !== 'ONGOING'`.

- [ ] **Step 5: Profile, notifications, lists**
  - `ProfileClient.tsx`: remove the live location toggle and the field from the preference type and save body.
  - `NotificationsClient.tsx`: add `'TRIP_STARTED'` to the type union and `TRIP_STARTED: FaCar` to the icon map. `notificationLink.ts`: add `'TRIP_STARTED'` to `ROUTABLE_TYPES`.
  - `TripsListClient.tsx` and the dashboard trip card: a small "In progress" badge when `trip.inProgress`.

- [ ] **Step 6: Type check and web tests** — `npx tsc --noEmit && npm run test:web`; Expected: clean, PASS.

- [ ] **Step 7: Commit** — `git commit -m "feat: Start Trip, End Trip and live run status on the trip page"`

### Task 8: Seeds, Postman, docs, full verification

**Files:**
- Modify: `server/scripts/seedDemo.js` (drop `liveLocationSharing`), `server/scripts/seedPostman.js` (if it sets it), `postman/RideShareEU.postman_collection.json` (folder "18. Trip runs"), `AGENTS.md`, roadmap (mark B done)

- [ ] **Step 1: Seeds** — remove `liveLocationSharing` from `seedDemo.js` preferences; give one demo trip a departure 10 minutes after seeding so the demo can show Start Trip. Run `npm run seed:demo` against `rideshare_demo`.

- [ ] **Step 2: Postman folder "18. Trip runs"** in the Automated folder, using the seeded host/passenger: create a trip departing in 10 minutes (pre-request script sets `departureTime`), passenger joins, host approves, `POST start` (201), passenger `POST start` (403), `POST location` with `etaSeconds` (200), passenger `GET location` (location + etaAt), host `PATCH cancel` (409 `TRIP_IN_PROGRESS`), `POST end` (200), `GET location` (null). Each asserts status and `responseTime < 2000`.

- [ ] **Step 3: Full suites** — `npm run test:server && npm run test:web && npx tsc --noEmit`; then `npm run seed:postman && npm run test:api` against `npm run server`. Expected: all pass.

- [ ] **Step 4: Browser check** (demo servers): as the driver, open the soon-departing trip → Start Trip → banner ticks, End Trip button, cancel hidden; as the approved rider in another context → banner, ETA, car on the map after a location post; End Trip → trip completed, rating prompt.

- [ ] **Step 5: Docs** — AGENTS.md "B. Trip lifecycle" notes (table, routes, codes, cron, location rules, removed preference); roadmap row B → done.

- [ ] **Step 6: Commit** — `git commit -m "docs: trip lifecycle notes, demo seed and Postman runs folder"`

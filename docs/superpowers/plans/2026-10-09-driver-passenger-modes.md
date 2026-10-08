# Driver and Passenger Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One account switches between Driver and Passenger mode, each showing only its own screens, and nobody can drive one trip while riding another at the same time.

**Architecture:** `User.activeMode` (enum `AppMode`) with `PATCH /api/users/me/mode`. A pure `server/services/scheduleRules.js` decides overlaps; join, post, schedule edit and approve call it and return 409 `SCHEDULE_CONFLICT`. Alerts accept `?mode=` and are sorted by whether the user hosts the notification's trip. The web app gets a `ModeProvider` in the signed-in layout; `Header`/`BottomNav` read tabs from a pure `src/lib/modeNav.ts`.

**Tech Stack:** Express 5, Prisma 7 (`db push`), Next.js 16 / React 19, Jest 30.

**Spec:** `docs/superpowers/specs/2026-10-09-driver-passenger-modes-design.md`

## Global Constraints

- New accounts start in `PASSENGER` mode; anyone may switch (license gating is sub-project E).
- The server never refuses an action because of the caller's mode; modes change only what the app shows.
- Overlap: shared Philippine day AND intersecting time spans; span = departure time of day to + `durationSeconds` (3600 when unknown); back-to-back (end = start) is not an overlap.
- 409 body: `{ error: 'SCHEDULE_CONFLICT', conflictTripId, conflictDepartureTime }`.
- Every new write route has a `strictBody` schema.
- Schema change is additive (no data loss); back up dev and demo first.
- Commits authored as `Xyrus <xyrusdimacali@gmail.com>`, no AI trailers.

---

### Task 1: Overlap rules (pure)

**Files:** Create `server/services/scheduleRules.js`; Test `server/services/__tests__/scheduleRules.test.js`

**Interfaces — Produces:** `timeSpan(trip) → { start, end }` (minutes after PH midnight, `end` may exceed 1440); `sharesADay(a, b) → boolean`; `overlaps(a, b) → boolean`; `findConflict(candidate, trips) → trip | null`.

- [ ] **Step 1: Failing test**

```js
const { timeSpan, sharesADay, overlaps, findConflict } = require('../scheduleRules');

// 2026-06-01T23:00Z = Tuesday 2 June, 7:00 AM Philippine time.
const trip = (over = {}) => ({
  id: 't', recurrenceType: 'ONE_TIME', customDays: [], durationSeconds: 1800,
  departureTime: new Date('2026-06-01T23:00:00Z'), ...over,
});

describe('timeSpan', () => {
  test('departure time of day in Philippine time, plus the route time', () => {
    expect(timeSpan(trip())).toEqual({ start: 420, end: 450 });
  });
  test('an unknown route time counts as 60 minutes', () => {
    expect(timeSpan(trip({ durationSeconds: null }))).toEqual({ start: 420, end: 480 });
  });
});

describe('sharesADay', () => {
  test('one-time trips on different dates never clash', () => {
    expect(sharesADay(trip(), trip({ departureTime: new Date('2026-06-02T23:00:00Z') }))).toBe(false);
  });
  test('a one-time trip and a weekday trip clash on a weekday, not on a Saturday', () => {
    const weekdays = trip({ recurrenceType: 'WEEKDAYS', departureTime: new Date('2026-05-31T23:00:00Z') });
    expect(sharesADay(trip(), weekdays)).toBe(true); // Tuesday
    expect(sharesADay(trip({ departureTime: new Date('2026-06-05T23:00:00Z') }), weekdays)).toBe(false); // Saturday
  });
  test('recurring trips clash when they share a weekday', () => {
    const daily = trip({ recurrenceType: 'DAILY' });
    expect(sharesADay(daily, trip({ recurrenceType: 'CUSTOM', customDays: [6] }))).toBe(true);
    expect(sharesADay(trip({ recurrenceType: 'WEEKDAYS' }), trip({ recurrenceType: 'CUSTOM', customDays: [0, 6] }))).toBe(false);
  });
});

describe('overlaps and findConflict', () => {
  test('back-to-back trips do not overlap; a 15-minute overlap does', () => {
    const at730 = trip({ id: 'b', departureTime: new Date('2026-06-01T23:30:00Z') });
    const at715 = trip({ id: 'c', departureTime: new Date('2026-06-01T23:15:00Z') });
    expect(overlaps(trip(), at730)).toBe(false);
    expect(overlaps(trip(), at715)).toBe(true);
    expect(findConflict(trip(), [at730, at715])).toBe(at715);
    expect(findConflict(trip(), [at730])).toBeNull();
  });
  test('a span past midnight overlaps an early-morning trip the next day only if it is the same run day', () => {
    const late = trip({ recurrenceType: 'DAILY', departureTime: new Date('2026-06-01T15:30:00Z'), durationSeconds: 3600 }); // 11:30 PM–12:30 AM
    const early = trip({ recurrenceType: 'DAILY', departureTime: new Date('2026-06-01T16:15:00Z') }); // 12:15 AM
    expect(overlaps(late, early)).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npx jest server/services/__tests__/scheduleRules.test.js` — FAIL (module missing).

- [ ] **Step 3: Implement**

```js
// When two trips would need the same person at the same time (sub-project C):
// they share a Philippine day and their time spans intersect. A span is the
// departure's time of day plus the route time (an hour when unknown).
const { recurrenceRunsOnDay, phDateOnly } = require('./recurrenceMath');

const PH_OFFSET_MIN = 8 * 60;
const DAY_MIN = 24 * 60;
const UNKNOWN_DURATION_S = 3600;
const WEEKDAYS = { DAILY: [0, 1, 2, 3, 4, 5, 6], WEEKDAYS: [1, 2, 3, 4, 5] };

function timeSpan(trip) {
  const d = trip.departureTime instanceof Date ? trip.departureTime : new Date(trip.departureTime);
  const start = (d.getUTCHours() * 60 + d.getUTCMinutes() + PH_OFFSET_MIN) % DAY_MIN;
  return { start, end: start + Math.round((trip.durationSeconds ?? UNKNOWN_DURATION_S) / 60) };
}

function weekdaysOf(trip) {
  return trip.recurrenceType === 'CUSTOM' ? trip.customDays : WEEKDAYS[trip.recurrenceType];
}

function sharesADay(a, b) {
  const aOnce = a.recurrenceType === 'ONE_TIME';
  const bOnce = b.recurrenceType === 'ONE_TIME';
  const day = (t) => phDateOnly(t.departureTime instanceof Date ? t.departureTime : new Date(t.departureTime));
  if (aOnce && bOnce) return day(a).getTime() === day(b).getTime();
  if (aOnce) return recurrenceRunsOnDay(b, day(b), day(a));
  if (bOnce) return recurrenceRunsOnDay(a, day(a), day(b));
  const bDays = new Set(weekdaysOf(b));
  return weekdaysOf(a).some((d) => bDays.has(d));
}

// Spans can run past midnight; compare them on the same 24-hour clock.
function spansIntersect(a, b) {
  const x = timeSpan(a);
  const y = timeSpan(b);
  return [0, DAY_MIN, -DAY_MIN].some((shift) => x.start < y.end + shift && y.start + shift < x.end);
}

function overlaps(a, b) {
  return sharesADay(a, b) && spansIntersect(a, b);
}

function findConflict(candidate, trips) {
  return trips.find((t) => t.id !== candidate.id && overlaps(candidate, t)) ?? null;
}

module.exports = { timeSpan, sharesADay, overlaps, findConflict };
```

- [ ] **Step 4: Run** — PASS. **Step 5: Commit** — `git commit -m "feat: rules for trips that clash in time"`

### Task 2: Mode on the account

**Files:** `prisma/schema.prisma` (enum `AppMode`, `User.activeMode AppMode @default(PASSENGER)`); `server/controllers/userController.js` (own record adds `activeMode`; `updateMode`); `server/routes/userRoutes.js`; `server/validation/bodySchemas.js` (`'user.mode': { mode: 'string' }`); Test `server/__tests__/userMode.test.js`

**Interfaces — Produces:** `PATCH /api/users/me/mode { mode: 'DRIVER'|'PASSENGER' }` → `{ activeMode }`; 400 `INVALID_MODE`. `GET /api/users/:id` own record includes `activeMode`.

- [ ] **Step 1: Back up dev and demo** (`node scripts/backup-db.mjs`, and with `DATABASE_URL` set to `rideshare_demo`).
- [ ] **Step 2: Failing test**

```js
// userMode.test.js (harness as in tripRuns.test.js: app.listen(0), bearer, newBag/makeUser/cleanup)
test('a new account is a passenger; switching to driver sticks; bad values are refused', async () => {
  if (guard()) return;
  const me = await makeUser(bag, { fullName: 'Mode User' });
  expect((await (await req('GET', `/api/users/${me.id}`, me.id)).json()).user.activeMode).toBe('PASSENGER');
  const res = await req('PATCH', '/api/users/me/mode', me.id, { mode: 'DRIVER' });
  expect(res.status).toBe(200);
  expect((await res.json()).activeMode).toBe('DRIVER');
  expect((await (await req('GET', `/api/users/${me.id}`, me.id)).json()).user.activeMode).toBe('DRIVER');
  const bad = await req('PATCH', '/api/users/me/mode', me.id, { mode: 'PILOT' });
  expect(bad.status).toBe(400);
  expect((await bad.json()).error).toBe('INVALID_MODE');
});

test("someone else's record never shows their mode", async () => {
  if (guard()) return;
  const a = await makeUser(bag, { fullName: 'A' });
  const b = await makeUser(bag, { fullName: 'B' });
  expect((await (await req('GET', `/api/users/${a.id}`, b.id)).json()).user.activeMode).toBeUndefined();
});
```

- [ ] **Step 3: Run** — FAIL.
- [ ] **Step 4: Implement** — schema, `db push` (dev, demo), `npx prisma generate`; in `userController.getById` add `activeMode` to the fields added for your own record (next to `email`); add

```js
const MODES = ['PASSENGER', 'DRIVER'];
// Switch between Driver and Passenger mode (sub-project C). A view setting:
// nothing else on the server depends on it.
async function updateMode(req, res) {
  const { mode } = req.body;
  if (!MODES.includes(mode)) return res.status(400).json({ error: 'INVALID_MODE' });
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { activeMode: mode }, select: { activeMode: true } });
  res.json(user);
}
```

route `router.patch('/me/mode', strictBody('user.mode'), updateMode);` (before `/:id` routes).
- [ ] **Step 5: Run** userMode, strictBody, crossUserAccess, usersAuth tests — PASS. **Commit** `feat: driver and passenger mode on the account`

### Task 3: Refuse clashing trips

**Files:** `server/services/scheduleConflicts.js` (DB lookups); `server/controllers/matchController.js` (`create`, `updateStatus`); `server/controllers/tripController.js` (`createTrip`, `updateTrip`); Test `server/__tests__/scheduleConflicts.test.js`

**Interfaces — Consumes:** `findConflict` (Task 1). **Produces:**
- `conflictWithHosted(userId, candidate, prisma) → trip | null` (OPEN/FULL trips the user hosts, excluding `candidate.id`)
- `conflictWithRides(userId, candidate, prisma) → trip | null` (OPEN/FULL trips the user has a PENDING/APPROVED match on, excluding `candidate.id`)
- `conflictBody(trip) → { error: 'SCHEDULE_CONFLICT', conflictTripId, conflictDepartureTime }`

- [ ] **Step 1: Failing tests** (harness as tripRuns.test.js; trips via `makeTrip` with explicit `departureTime`/`durationSeconds`):
  - host H drives at 7:00 (30 min) tomorrow; H joins rider-trip at 7:15 tomorrow → 409 `SCHEDULE_CONFLICT` with `conflictTripId` = H's trip; joining one at 9:00 → 201.
  - rider R has a PENDING match on a 7:00 trip; R posts (`POST /api/trips`, full valid body as in `tripsAuth.test.js` `tripBody()`) at 7:15 → 409; at 10:00 → 201.
  - R edits their own 10:00 trip to 7:10 → 409, departure unchanged.
  - rider R2 requested H2's 8:00 trip, then R2 is given (via `makeTrip`) a hosted trip at 8:10; H2 approves → 409 and the match stays PENDING.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `scheduleConflicts.js`:

```js
const { findConflict } = require('./scheduleRules');

const ACTIVE = ['OPEN', 'FULL'];
const FIELDS = { id: true, departureTime: true, durationSeconds: true, recurrenceType: true, customDays: true };

async function conflictWithHosted(userId, candidate, db) {
  const trips = await db.trip.findMany({ where: { hostId: userId, status: { in: ACTIVE } }, select: FIELDS });
  return findConflict(candidate, trips);
}

async function conflictWithRides(userId, candidate, db) {
  const matches = await db.match.findMany({
    where: { passengerId: userId, status: { in: ['PENDING', 'APPROVED'] }, trip: { status: { in: ACTIVE } } },
    select: { trip: { select: FIELDS } },
  });
  return findConflict(candidate, matches.map((m) => m.trip));
}

const conflictBody = (trip) => ({ error: 'SCHEDULE_CONFLICT', conflictTripId: trip.id, conflictDepartureTime: trip.departureTime });

module.exports = { conflictWithHosted, conflictWithRides, conflictBody };
```

Wire in (each returns `res.status(409).json(conflictBody(conflict))`):
- `matchController.create`, after `joinBlockReason`: `conflictWithHosted(passengerId, trip, prisma)`.
- `matchController.updateStatus`, after `stillEligible`, when approving: `conflictWithHosted(existing.passengerId, existing.trip, prisma)`.
- `tripController.createTrip`, after `validateNewTrip` passes: candidate `{ id: null, departureTime: new Date(body.departureTime), durationSeconds: body.durationSeconds ?? null, recurrenceType: body.recurrenceType, customDays: body.customDays ?? [] }` → `conflictWithRides(userId, candidate, prisma)`.
- `tripController.updateTrip`, after `pointOutsideLuzon`, when `departureTime`, `recurrenceType`, `customDays` or `durationSeconds` is in `incoming`: candidate = trip merged with incoming → `conflictWithRides(userId, candidate, prisma)`.
- [ ] **Step 4: Run** the new test plus tripsAuth, matchAuth, womenPlusJoin, tripEditDetail, tripRuns — PASS. **Commit** `feat: refuse joining, posting or approving trips that clash in time`

### Task 4: Alerts by mode

**Files:** `server/controllers/notificationController.js`; Test `server/__tests__/alertsByMode.test.js`

**Interfaces — Produces:** `GET /api/alerts?mode=driver|passenger` → `{ notifications, nextCursor, otherModeUnread }`; without `mode` unchanged.

- [ ] **Step 1: Failing test:** user U hosts trip T1 and rides trip T2. Create notifications: MATCH_REQUEST on T1 (unread), APPROVAL on T2 (unread), ANNOUNCEMENT with no trip. `?mode=driver` → T1's and the announcement, `otherModeUnread: 1`; `?mode=passenger` → T2's and the announcement, `otherModeUnread: 1`; no mode → all three.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** in `list`:

```js
  const mode = req.query.mode === 'driver' || req.query.mode === 'passenger' ? req.query.mode : null;
  let where = { userId: req.user.id };
  let otherModeUnread;
  if (mode) {
    // A notification belongs to Driver mode when the user hosts its trip,
    // to Passenger mode when it's about another trip; without a trip it shows in both.
    const hosted = (await prisma.trip.findMany({ where: { hostId: req.user.id }, select: { id: true } })).map((t) => t.id);
    const driverSide = { relatedTripId: { in: hosted } };
    const passengerSide = { relatedTripId: { not: null, notIn: hosted } };
    const mine = mode === 'driver' ? driverSide : passengerSide;
    const other = mode === 'driver' ? passengerSide : driverSide;
    where = { userId: req.user.id, OR: [mine, { relatedTripId: null }] };
    otherModeUnread = await prisma.notification.count({ where: { userId: req.user.id, isRead: false, ...other } });
  }
```

use `where` in `findMany`, and `res.json({ notifications, nextCursor, ...(mode && { otherModeUnread }) })`.
- [ ] **Step 4: Run** new test plus alertsAuth — PASS. **Commit** `feat: notifications for the current mode`

### Task 5: Web helpers (pure)

**Files:** Create `src/lib/modeNav.ts`; Test `src/lib/__tests__/modeNav.test.ts`

**Interfaces — Produces:** `type AppMode = 'DRIVER' | 'PASSENGER'`; `tabsFor(mode) → { key, href, label }[]`; `otherMode(mode)`; `modeLabel(mode)`; `conflictMessage(departure: string) → string`.

- [ ] **Step 1: Failing test**

```ts
import { describe, test, expect } from '@jest/globals';
import { tabsFor, otherMode, conflictMessage } from '../modeNav';

describe('mode navigation', () => {
  test('passenger and driver tabs', () => {
    expect(tabsFor('PASSENGER').map((t) => t.label)).toEqual(['Home', 'Find a Ride', 'My Rides', 'Alerts', 'Profile']);
    expect(tabsFor('DRIVER').map((t) => t.label)).toEqual(['Home', 'Post a Trip', 'My Trips', 'Alerts', 'Profile']);
    expect(tabsFor('DRIVER')[1].href).toBe('/auth/post');
    expect(otherMode('DRIVER')).toBe('PASSENGER');
  });
  test('a clash names the time of the other trip', () => {
    expect(conflictMessage('2026-06-01T23:00:00Z')).toBe('You already have a trip at 7:00 AM that overlaps this one. Pick a different time or ride.');
  });
});
```

- [ ] **Step 2: Run** `npx jest -c jest.web.config.mjs src/lib/__tests__/modeNav.test.ts` — FAIL.
- [ ] **Step 3: Implement**

```ts
import { clockLabel } from './tripRun';

export type AppMode = 'DRIVER' | 'PASSENGER';
export type TabKey = 'dashboard' | 'search' | 'post' | 'trips' | 'notifications' | 'profile';

const HOME = { key: 'dashboard' as TabKey, href: '/auth/dashboard', label: 'Home' };
const ALERTS = { key: 'notifications' as TabKey, href: '/auth/notifications', label: 'Alerts' };
const PROFILE = { key: 'profile' as TabKey, href: '/auth/profile', label: 'Profile' };

export function tabsFor(mode: AppMode) {
  return mode === 'DRIVER'
    ? [HOME, { key: 'post' as TabKey, href: '/auth/post', label: 'Post a Trip' }, { key: 'trips' as TabKey, href: '/auth/trips', label: 'My Trips' }, ALERTS, PROFILE]
    : [HOME, { key: 'search' as TabKey, href: '/auth/search', label: 'Find a Ride' }, { key: 'trips' as TabKey, href: '/auth/trips', label: 'My Rides' }, ALERTS, PROFILE];
}

export const otherMode = (mode: AppMode): AppMode => (mode === 'DRIVER' ? 'PASSENGER' : 'DRIVER');
export const modeLabel = (mode: AppMode) => (mode === 'DRIVER' ? 'Driver' : 'Passenger');

export function conflictMessage(departure: string): string {
  return `You already have a trip at ${clockLabel(departure)} that overlaps this one. Pick a different time or ride.`;
}
```

- [ ] **Step 4: Run** — PASS. **Commit** `feat: tabs and messages for each mode`

### Task 6: Screens

**Files:** `src/lib/session.ts` (`cache()` around `getCurrentUser`; `CurrentUser.activeMode`); Create `src/components/ModeProvider.tsx` (`ModeProvider`, `useMode()`), `src/components/ModeSwitchButton.tsx`, `src/components/WrongModeNotice.tsx`; Modify `src/app/auth/layout.tsx`, `src/components/Header.tsx`, `src/components/BottomNav.tsx`, `src/app/auth/dashboard/page.tsx`, `src/app/auth/trips/page.tsx` + `TripsListClient.tsx`, `src/app/auth/search/page.tsx`, `src/app/auth/post/page.tsx`, `src/app/auth/notifications/page.tsx` + `NotificationsClient.tsx`, `src/app/auth/profile/ProfileClient.tsx`, `src/app/auth/rides/[id]/RideDetailClient.tsx` (join error), `src/app/auth/post/PostTripForm.tsx` (post error)

- [ ] **Step 1: Mode in the shell.** `session.ts`: `export const getCurrentUser = cache(async () => …)` (import `{ cache }` from `react`), `activeMode: AppMode` on `CurrentUser`. `layout.tsx`: after the suspension check, `const user = await getCurrentUser();` and wrap children in `<ModeProvider mode={user?.activeMode ?? 'PASSENGER'}>`. `ModeProvider` is a client context with `{ mode }`.
- [ ] **Step 2: Tabs.** `Header` and `BottomNav` map over `tabsFor(useMode().mode)`; `ActiveRoute` gains `'search'`. BottomNav uses icons Home `FaHome`, Find a Ride `FaSearch`, Post a Trip `FaPlusCircle`, My Trips/My Rides `FaCar`, Alerts `FaBell`, Profile `FaUser`; the active colour is maroon in Driver mode and emerald-700 in Passenger mode. The header shows a small mode chip ("Driver" / "Passenger") and `ModeSwitchButton`.
- [ ] **Step 3: `ModeSwitchButton`** — "Switch to Driver" / "Switch to Passenger"; `PATCH /api/users/me/mode`, then `router.push('/auth/dashboard'); router.refresh()`; on failure shows "Couldn't switch. Try again."
- [ ] **Step 4: Home.** Dashboard reads the mode: Driver shows only the Post a Trip card and hosted upcoming trips (plus "N requests waiting" from pending matches, linking to the trip); Passenger shows only the Find a Ride card and joined upcoming rides. Alerts fetch uses `?mode=` and the badge counts that list's unread.
- [ ] **Step 5: My Trips / My Rides.** `trips/page.tsx` passes `mode`; `TripsListClient` renders only `hosted` (Driver) or only `joined` (Passenger), title "My Trips" / "My Rides", tab counts from that list only.
- [ ] **Step 6: Strict pages.** `search/page.tsx` in Driver mode and `post/page.tsx` in Passenger mode render `<WrongModeNotice need="PASSENGER" | "DRIVER" />`: a card "Finding a ride is in Passenger mode." / "Posting a trip is in Driver mode." with `ModeSwitchButton`.
- [ ] **Step 7: Alerts.** `notifications/page.tsx` fetches `?mode=`; `NotificationsClient` shows "{n} new in {other mode} mode · Switch" (with `ModeSwitchButton`) when `otherModeUnread > 0`, and pages with `&mode=` too.
- [ ] **Step 8: Profile.** A "Mode" row with the current mode and `ModeSwitchButton`.
- [ ] **Step 9: Conflict messages.** `RideDetailClient` join and `PostTripForm` submit: on `ApiError` code `SCHEDULE_CONFLICT`, show `conflictMessage(err.body.conflictDepartureTime)` (use whatever field `ApiError` exposes for the body; check `src/lib/api.ts`).
- [ ] **Step 10:** `npx tsc --noEmit && npm run test:web` — clean, PASS. **Commit** `feat: driver and passenger modes in the app`

### Task 7: Seeds, Postman, docs, verification

- [ ] **Step 1: Demo seed** — set `activeMode: 'DRIVER'` for Juan, Miguel, Ana, Carlo (drivers) after creating users (`prisma.user.updateMany`). Reseed demo.
- [ ] **Step 2: Postman "19. Modes and schedule conflicts"** — host switches to DRIVER (200), bad mode (400), passenger's own record shows `PASSENGER`; passenger alerts `?mode=passenger` returns `otherModeUnread`; the passenger posts a trip at the same time as a ride they joined → 409 `SCHEDULE_CONFLICT`; at a later time → 201, then cancelled to clean up.
- [ ] **Step 3: Full suites** — `npm run test:server && npm run test:web && npx tsc --noEmit`; `npm run seed:postman && npm run test:api` (fresh API).
- [ ] **Step 4: Browser** (demo, phone width): Paolo (passenger) sees passenger tabs and home; Find a Ride works; Post a Trip shows the wrong-mode notice; switches to Driver → driver tabs. Miguel (driver) sees requests on home; Alerts nudge; a clashing join shows the message.
- [ ] **Step 5: Docs** — AGENTS.md "C. Driver and passenger modes"; roadmap C → done. **Commit** `docs: driver and passenger modes notes and Postman folder`

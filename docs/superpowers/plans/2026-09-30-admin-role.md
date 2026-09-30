# Admin Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin role: an official fuel-price cap, report review and bans, user and trip oversight, a dashboard, and an audit log. The API is under `/api/admin/*` and the UI under `/auth/admin`.

**Architecture:** `User.isAdmin` is read by `authenticate` on every request. The `requireAdmin` middleware guards one admin router, which calls small controllers under `server/controllers/admin/`. Business rules live in services. Every admin write records an `AdminAction` row inside the same Prisma transaction. The frontend adds server-rendered admin pages that reuse the existing `Header`, `Card`, `Badge` and `apiFetch`.

**Tech Stack:**
- Express 5 (async errors reach the error handler) and Prisma 7 on PostgreSQL 17
- Jest 30 integration tests (`fetch` against `app.listen(0)`, real local DB, `dbUp` guard)
- Next.js 16 App Router: `params` is a Promise; `notFound()` comes from `next/navigation`
- Tailwind 4, newman

**Spec:** `docs/superpowers/specs/2026-09-30-admin-role-design.md`

## Global Constraints

- **Errors** use the existing envelope `{ error: 'UPPER_SNAKE_CODE' }`, with extra fields only where noted.
- **Encrypted fields:**
  - `fullName`, `gender` and the trip addresses are stored encrypted.
  - Always decrypt with `decryptField` / `decryptUserFields` / `decryptTripFields` before responding.
  - Never return `passwordHash`; select with `safeUserSelect` or explicit fields.
- **Price and ban bounds:**
  - Fuel price bounds are PHP 20–150.
  - Ban durations: `24H` | `7D` | `30D` | `PERMANENT`.
  - Ban reasons are `ReportCategory` codes, because `BannedScreen` and the ban email show category labels.
  - Notes are trimmed and at most 500 characters.
- **Tests that trigger a ban email** must `delete process.env.SMTP_HOST` in `beforeAll` and restore it in `afterAll`, as `reports.test.js` does.
- **Commits:**
  - Author `Xyrus <xyrusdimacali@gmail.com>`, conventional prefix, no AI trailers.
  - Stage files explicitly; never commit `next-env.d.ts`.
- **Code style:** no `console.log` in new code (the existing `console.warn`/`console.error` patterns are fine), and no comments that narrate the change.

### Refinements to the spec

- **Ban body.** `{ duration, reason, note }`, where `reason` is a `ReportCategory`. The suspended screen and ban email render `banReason` through the category-label map; free text goes in the audit `details.note`.
- **`LAST_ADMIN` dropped.** Self-demotion is blocked (`CANNOT_TARGET_SELF`), so the acting admin always remains and a last-admin state is unreachable through the API. A test for it would depend on the admins in the developer's local DB.
- **User search runs entirely in memory.** Names can't be searched in SQL, and email and university ID are matched in the same single pass. The result stays capped at 50.

## File Map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `isAdmin`, `ReportStatus`, report review fields, `FuelPrice`, `AdminAction`, `AdminActionType` |
| `server/services/adminActionService.js` | `record(tx, entry)`, `withNames(actions)` |
| `server/services/adminModerationService.js` | `AdminError`, `normalizeNote`, `banUser`, `notifyBan`, `unbanUser`, `setAdmin`, `sendAdminError` |
| `server/services/fuelPriceService.js` | bounds, `isValidFuelPrice`, `getOfficialFuelPrice` |
| `server/services/tripCancellationService.js` | `cancelWholeTrip(tx, trip, { reason, byAdmin })` |
| `server/middleware/requireAdmin.js` | 403 `ADMIN_ONLY` guard |
| `server/routes/adminRoutes.js` | admin router |
| `server/controllers/admin/overviewController.js` | `overview`, `listActions` |
| `server/controllers/admin/userController.js` | `searchUsers`, `getUserDetail`, `ban`, `unban`, `promote`, `demote` |
| `server/controllers/admin/reportController.js` | `listReports`, `reviewReport` |
| `server/controllers/admin/tripController.js` | `cancelTripAsAdmin` |
| `server/controllers/fuelPriceController.js` | `getOfficial`, `setOfficial`, `history` |
| `server/scripts/makeAdmin.js` | `npm run make-admin <email>` |
| `src/lib/admin.ts` | admin types and label helpers (client-safe) |
| `src/app/auth/admin/**` | layout, nav, overview, reports, users, user detail, fuel price, activity |

---

### Task 1: Schema, audit service, make-admin script

**Files:**
- Modify: `prisma/schema.prisma`, `server/test-helpers/seed.js`, `server/scripts/seedPostman.js`, `package.json`
- Create: `server/services/adminActionService.js`, `server/scripts/makeAdmin.js`
- Test: `server/__tests__/adminAudit.test.js`

**Interfaces:**
- Produces:
  - `record(tx, { actorId?, action, targetUserId?, targetTripId?, targetReportId?, details? }) → Promise<AdminAction>`
  - `withNames(actions) → Promise<Array<AdminAction & { actorName, targetUserName }>>`
  - `promoteByEmail(email) → Promise<{ alreadyAdmin: boolean }>`
  - seed helper `makeAdminUser(bag, opts)`

- [ ] **Step 1: Back up the DB and extend the schema**

Run `node scripts/backup-db.mjs`. Then make these schema changes:

```prisma
enum ReportStatus {
  OPEN
  REVIEWED
  DISMISSED
}

enum AdminActionType {
  BAN
  UNBAN
  REPORT_REVIEWED
  REPORT_DISMISSED
  TRIP_CANCELLED
  FUEL_PRICE_SET
  PROMOTE
  DEMOTE
}
```

In `model User`, add after `hasSeenOnboarding`:

```prisma
  isAdmin Boolean @default(false)
```

Add to its relation list:

```prisma
  reportsReviewed Report[]      @relation("ReportsReviewed")
  fuelPricesSet   FuelPrice[]
  adminActions    AdminAction[] @relation("AdminActionActor")
```

In `model Report`, add before the indexes:

```prisma
  status       ReportStatus @default(OPEN)
  reviewedById String?
  reviewedBy   User?        @relation("ReportsReviewed", fields: [reviewedById], references: [id])
  reviewedAt   DateTime?
  reviewNote   String?

  @@index([status, createdAt])
```

Add the new models:

```prisma
model FuelPrice {
  id            String   @id @default(cuid())
  pricePerLiter Float
  setById       String
  setBy         User     @relation(fields: [setById], references: [id])
  createdAt     DateTime @default(now())

  @@index([createdAt])
}

model AdminAction {
  id             String          @id @default(cuid())
  actorId        String?
  actor          User?           @relation("AdminActionActor", fields: [actorId], references: [id])
  action         AdminActionType
  targetUserId   String?
  targetTripId   String?
  targetReportId String?
  details        Json?
  createdAt      DateTime        @default(now())

  @@index([createdAt])
  @@index([targetUserId, createdAt])
}
```

Target ids are plain strings, not foreign keys, so the audit trail survives trip or report deletion. Also rewrite the User comment block that says "there's no admin role in this app, deliberately" to: "Automated moderation state — set by the strike ladder in reportEnforcementService.js or by an admin (/api/admin/users/:id/ban); every change is recorded in AdminAction."

Run: `npx prisma db push`. Expected: "Your database is now in sync".

- [ ] **Step 2: Write the failing test** `server/__tests__/adminAudit.test.js`

```js
require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { record, withNames } = require('../services/adminActionService');
const { promoteByEmail } = require('../scripts/makeAdmin');
const { newBag, makeUser, cleanup } = require('../test-helpers/seed');

let dbUp = false;
const bag = newBag();

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;

describe('adminActionService.record', () => {
  test('writes one audit row with the given fields', async () => {
    if (guard()) return;
    const actor = await makeUser(bag, { fullName: 'Audit Actor' });
    const target = await makeUser(bag, { fullName: 'Audit Target' });

    const row = await record(prisma, {
      actorId: actor.id,
      action: 'BAN',
      targetUserId: target.id,
      details: { duration: '24H' },
    });

    expect(row.action).toBe('BAN');
    expect(row.details).toEqual({ duration: '24H' });
    const [named] = await withNames([row]);
    expect(named.actorName).toBe('Audit Actor');
    expect(named.targetUserName).toBe('Audit Target');
  });

  test('rolls back with the surrounding transaction', async () => {
    if (guard()) return;
    const target = await makeUser(bag);
    await expect(
      prisma.$transaction(async (tx) => {
        await record(tx, { action: 'UNBAN', targetUserId: target.id });
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(await prisma.adminAction.count({ where: { targetUserId: target.id } })).toBe(0);
  });
});

describe('make-admin script', () => {
  test('promotes by email and records a PROMOTE row with no actor', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    expect(await promoteByEmail(user.email)).toEqual({ alreadyAdmin: false });
    const saved = await prisma.user.findUnique({ where: { id: user.id }, select: { isAdmin: true } });
    expect(saved.isAdmin).toBe(true);
    const audit = await prisma.adminAction.findFirst({ where: { targetUserId: user.id, action: 'PROMOTE' } });
    expect(audit.actorId).toBeNull();
    expect(await promoteByEmail(user.email)).toEqual({ alreadyAdmin: true });
  });

  test('rejects an unknown email', async () => {
    if (guard()) return;
    await expect(promoteByEmail('nobody-here@test.local')).rejects.toThrow('USER_NOT_FOUND');
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx jest server/__tests__/adminAudit.test.js`
Expected: FAIL, "Cannot find module '../services/adminActionService'".

- [ ] **Step 4: Implement** `server/services/adminActionService.js`

```js
const prisma = require('../config/db');
const { decryptField } = require('./encryptionService');

// Pass the transaction client so an admin change and its audit row commit or
// roll back together.
function record(tx, { actorId = null, action, targetUserId = null, targetTripId = null, targetReportId = null, details }) {
  return tx.adminAction.create({
    data: { actorId, action, targetUserId, targetTripId, targetReportId, details: details ?? undefined },
  });
}

async function withNames(actions) {
  const ids = [...new Set(actions.flatMap((a) => [a.actorId, a.targetUserId]).filter(Boolean))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, decryptField(u.fullName)]));
  return actions.map((a) => ({
    ...a,
    actorName: a.actorId ? nameById.get(a.actorId) ?? null : null,
    targetUserName: a.targetUserId ? nameById.get(a.targetUserId) ?? null : null,
  }));
}

module.exports = { record, withNames };
```

- [ ] **Step 5: Implement** `server/scripts/makeAdmin.js`

```js
// Grants admin to an existing account: npm run make-admin <email>
// Only for the first admin — after that, admins promote each other in the app.
require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { record } = require('../services/adminActionService');

async function promoteByEmail(email) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isAdmin: true } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.isAdmin) return { alreadyAdmin: true };
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { isAdmin: true } });
    await record(tx, { action: 'PROMOTE', targetUserId: user.id, details: { via: 'make-admin script' } });
  });
  return { alreadyAdmin: false };
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run make-admin <email>');
    process.exitCode = 1;
    return;
  }
  try {
    const { alreadyAdmin } = await promoteByEmail(email.trim().toLowerCase());
    console.warn(alreadyAdmin ? `${email} is already an admin.` : `${email} is now an admin.`);
  } catch (err) {
    console.error(err.message === 'USER_NOT_FOUND' ? `No account with email ${email}.` : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();

module.exports = { promoteByEmail };
```

Add to the `package.json` scripts: `"make-admin": "node server/scripts/makeAdmin.js"`.

- [ ] **Step 6: Keep test cleanup foreign-key-safe**

In `server/test-helpers/seed.js`, add after `makeUser`:

```js
async function makeAdminUser(bag, opts) {
  const user = await makeUser(bag, opts);
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  return { ...user, isAdmin: true };
}
```

Export it. In `cleanup`, insert before the final `prisma.user.deleteMany`:

```js
  await prisma.adminAction.deleteMany({
    where: { OR: [{ actorId: { in: bag.userIds } }, { targetUserId: { in: bag.userIds } }] },
  });
  await prisma.fuelPrice.deleteMany({ where: { setById: { in: bag.userIds } } });
```

The existing `report.deleteMany` runs first and removes reports filed by or against bag users. Also add `{ reviewedById: { in: bag.userIds } }` to that `OR`.

Apply the same three additions in `server/scripts/seedPostman.js` `removeExisting`:
- `reviewedById` goes in the report `OR`.
- `adminAction.deleteMany` over actor/target and `fuelPrice.deleteMany` go before `user.deleteMany`.

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npx jest server/__tests__/adminAudit.test.js`. Expected: 4 passed.
Run: `npm test`. Expected: all suites pass (the schema change is additive).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma server/services/adminActionService.js server/scripts/makeAdmin.js server/test-helpers/seed.js server/scripts/seedPostman.js server/__tests__/adminAudit.test.js package.json
git commit -m "feat: add admin schema, audit log service and make-admin script"
```

---

### Task 2: Admin guard, router, overview and audit-log endpoints

**Files:**
- Modify: `server/middleware/authenticate.js`, `server/app.js`, `server/controllers/userController.js`
- Create: `server/middleware/requireAdmin.js`, `server/routes/adminRoutes.js`, `server/controllers/admin/overviewController.js`
- Test: `server/__tests__/adminAccess.test.js`

**Interfaces:**
- Consumes: `withNames` (Task 1), `makeAdminUser` (Task 1).
- Produces:
  - `req.user.isAdmin: boolean`
  - `requireAdmin(req, res, next)`
  - the admin `router`, which later tasks add routes to
  - `GET /api/admin/overview` → `{ counts: { users, admins, openTrips, completedTrips, pendingRequests, openReports, activeBans }, recentActions }`
  - `GET /api/admin/actions?cursor=` → `{ actions, nextCursor }`
  - `GET /api/users/:id` includes `isAdmin` on your own record only

- [ ] **Step 1: Write the failing test** `server/__tests__/adminAccess.test.js`

```js
require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, cleanup } = require('../test-helpers/seed');

let server;
let base;
let dbUp = false;
const bag = newBag();

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;
const get = (path, userId) => fetch(`${base}${path}`, { headers: userId ? bearer(userId) : {} });

describe('admin guard', () => {
  test('no token → 401', async () => {
    const res = await get('/api/admin/overview');
    expect(res.status).toBe(401);
  });

  test('a regular user → 403 ADMIN_ONLY', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const res = await get('/api/admin/overview', user.id);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('ADMIN_ONLY');
  });

  test('an admin gets the overview counts and recent actions', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const res = await get('/api/admin/overview', admin.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const key of ['users', 'admins', 'openTrips', 'completedTrips', 'pendingRequests', 'openReports', 'activeBans']) {
      expect(typeof body.counts[key]).toBe('number');
    }
    expect(body.counts.admins).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.recentActions)).toBe(true);
  });

  test('a demoted admin is refused on the very next request', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    expect((await get('/api/admin/overview', admin.id)).status).toBe(200);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: false } });
    expect((await get('/api/admin/overview', admin.id)).status).toBe(403);
  });
});

describe('GET /api/admin/actions', () => {
  test('pages the audit log newest first', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const target = await makeUser(bag);
    await prisma.adminAction.create({ data: { actorId: admin.id, action: 'UNBAN', targetUserId: target.id } });
    const res = await get('/api/admin/actions', admin.id);
    expect(res.status).toBe(200);
    const { actions, nextCursor } = await res.json();
    expect(actions[0]).toMatchObject({ action: 'UNBAN', targetUserId: target.id });
    expect(actions[0].actorName).toBeTruthy();
    expect(nextCursor === null || typeof nextCursor === 'string').toBe(true);
  });
});

describe('GET /api/users/:id isAdmin visibility', () => {
  test('own record includes isAdmin; someone else’s does not', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const other = await makeUser(bag);
    const own = await (await get(`/api/users/${admin.id}`, admin.id)).json();
    expect(own.user.isAdmin).toBe(true);
    const theirs = await (await get(`/api/users/${admin.id}`, other.id)).json();
    expect(theirs.user).not.toHaveProperty('isAdmin');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest server/__tests__/adminAccess.test.js`. Expected: FAIL (404 on `/api/admin/overview`, no `isAdmin`).

- [ ] **Step 3: Implement the guard**

In `server/middleware/authenticate.js`, change the select to `{ bannedUntil: true, banReason: true, banSeverity: true, isAdmin: true }` and the final assignment to:

```js
  req.user = { id: userId, isAdmin: user?.isAdmin === true };
```

Create `server/middleware/requireAdmin.js`:

```js
// Runs after authenticate, which re-reads isAdmin from the database on every
// request — so a demotion takes effect immediately, not when the token expires.
function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'ADMIN_ONLY' });
  return next();
}

module.exports = { requireAdmin };
```

- [ ] **Step 4: Implement** `server/controllers/admin/overviewController.js`

```js
const prisma = require('../../config/db');
const { withNames } = require('../../services/adminActionService');

const RECENT_ACTIONS = 10;
const ACTIONS_PAGE_SIZE = 25;

async function overview(req, res) {
  const now = new Date();
  const [users, admins, openTrips, completedTrips, pendingRequests, openReports, activeBans, recent] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isAdmin: true } }),
    prisma.trip.count({ where: { status: { in: ['OPEN', 'FULL'] } } }),
    prisma.trip.count({ where: { status: 'COMPLETED' } }),
    prisma.match.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.user.count({ where: { bannedUntil: { gt: now } } }),
    prisma.adminAction.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: RECENT_ACTIONS }),
  ]);
  res.json({
    counts: { users, admins, openTrips, completedTrips, pendingRequests, openReports, activeBans },
    recentActions: await withNames(recent),
  });
}

async function listActions(req, res) {
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const rows = await prisma.adminAction.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: ACTIONS_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > ACTIONS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, ACTIONS_PAGE_SIZE) : rows;
  res.json({ actions: await withNames(page), nextCursor: hasMore ? page[page.length - 1].id : null });
}

module.exports = { overview, listActions };
```

- [ ] **Step 5: Wire the router**

Create `server/routes/adminRoutes.js`:

```js
const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');
const { overview, listActions } = require('../controllers/admin/overviewController');

const router = express.Router();
router.use(requireAdmin);

router.get('/overview', overview);
router.get('/actions', listActions);

module.exports = router;
```

In `server/app.js`, add `const adminRoutes = require('./routes/adminRoutes');` with the other route requires, and `app.use('/api/admin', adminRoutes);` right after `app.use('/api/alerts', notificationRoutes);`.

- [ ] **Step 6: Expose `isAdmin` on your own record**

In `server/controllers/userController.js` `getById`:
- Select `{ ...safeUserSelect, isAdmin: true }`.
- Replace the destructure with `const { email, isAdmin, ...rest } = user;`, keeping `const visible = isOwnProfile ? user : rest;`.

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npx jest server/__tests__/adminAccess.test.js server/__tests__/usersAuth.test.js server/__tests__/authenticate.test.js`. Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add server/middleware/authenticate.js server/middleware/requireAdmin.js server/routes/adminRoutes.js server/controllers/admin/overviewController.js server/controllers/userController.js server/app.js server/__tests__/adminAccess.test.js
git commit -m "feat: add admin guard, overview and audit log endpoints"
```

---

### Task 3: Official fuel price and the cap on trip creation

**Files:**
- Create: `server/services/fuelPriceService.js`, `server/controllers/fuelPriceController.js`
- Modify: `server/controllers/tripController.js:10-16,86-96`, `server/routes/adminRoutes.js`, `server/app.js`, `server/__tests__/tripsAuth.test.js`
- Test: `server/__tests__/adminFuelPrice.test.js`

**Interfaces:**
- Consumes: `record` (Task 1), the admin router (Task 2).
- Produces:
  - `getOfficialFuelPrice(client?) → Promise<{ pricePerLiter, updatedAt } | null>`
  - `isValidFuelPrice(n) → boolean`
  - `MIN_FUEL_PRICE_PER_LITER`, `MAX_FUEL_PRICE_PER_LITER`
  - `GET /api/fuel-price` → `{ official: number | null, updatedAt: string | null }`
  - `PUT /api/admin/fuel-price` → the same shape
  - `GET /api/admin/fuel-price/history` → `{ history: [{ id, pricePerLiter, createdAt, setBy: { id, fullName } }] }`
  - `createTrip` 400 → `{ error: 'FUEL_PRICE_ABOVE_OFFICIAL', officialPrice }`

- [ ] **Step 1: Isolate the existing trip tests from the global price**

At the top of `server/__tests__/tripsAuth.test.js`, after the requires:

```js
// Its fuel-price bound tests assume no official cap; the real cap is covered
// in adminFuelPrice.test.js. Mocked per file so a price set in the dev DB (or
// by that file running in parallel) can't change these results.
jest.mock('../services/fuelPriceService', () => ({
  ...jest.requireActual('../services/fuelPriceService'),
  getOfficialFuelPrice: jest.fn().mockResolvedValue(null),
}));
```

- [ ] **Step 2: Write the failing test** `server/__tests__/adminFuelPrice.test.js`

```js
require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, cleanup } = require('../test-helpers/seed');

let server;
let base;
let dbUp = false;
const bag = newBag();
const TEST_PRICE = 149;

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (dbUp) {
    const created = await prisma.trip.findMany({ where: { hostId: { in: bag.userIds } }, select: { id: true } });
    bag.tripIds.push(...created.map((t) => t.id));
    await cleanup(bag);
  }
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;
const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? bearer(userId) : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

function tripBody(vehicleId, fuelPricePerLiter) {
  return {
    vehicleId,
    originAddress: 'Sariaya, Quezon',
    originLat: 13.9629837,
    originLng: 121.5243402,
    destinationAddress: 'MSEUF',
    destinationLat: 13.9490188,
    destinationLng: 121.6202904,
    departureTime: new Date(Date.now() + 2 * 86400000).toISOString(),
    recurrenceType: 'ONE_TIME',
    customDays: [],
    totalSeats: 3,
    genderPreference: 'ANY',
    flexibleDeparture: false,
    flexWindowMinutes: 15,
    familiarRidersOnly: false,
    distanceMeters: 12500,
    durationSeconds: 1200,
    fuelPricePerLiter,
  };
}

describe('official fuel price', () => {
  test('a regular user can read it but not set it', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const read = await call('GET', '/api/fuel-price', user.id);
    expect(read.status).toBe(200);
    expect(await read.json()).toHaveProperty('official');
    const write = await call('PUT', '/api/admin/fuel-price', user.id, { pricePerLiter: 60 });
    expect(write.status).toBe(403);
  });

  test.each([[19.99], [150.01], ['abc'], [undefined]])('rejects %p with 400 INVALID_FUEL_PRICE', async (price) => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const res = await call('PUT', '/api/admin/fuel-price', admin.id, { pricePerLiter: price });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_FUEL_PRICE');
  });

  test('an admin sets it; it becomes current, appears in history and the audit log, and caps new trips', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag, { fullName: 'Price Admin' });
    const host = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);

    const set = await call('PUT', '/api/admin/fuel-price', admin.id, { pricePerLiter: TEST_PRICE });
    expect(set.status).toBe(200);
    expect((await set.json()).official).toBe(TEST_PRICE);

    expect((await (await call('GET', '/api/fuel-price', host.id)).json()).official).toBe(TEST_PRICE);

    const { history } = await (await call('GET', '/api/admin/fuel-price/history', admin.id)).json();
    expect(history[0]).toMatchObject({ pricePerLiter: TEST_PRICE, setBy: { id: admin.id, fullName: 'Price Admin' } });

    const audit = await prisma.adminAction.findFirst({ where: { actorId: admin.id, action: 'FUEL_PRICE_SET' } });
    expect(audit.details.to).toBe(TEST_PRICE);

    const above = await call('POST', '/api/trips', host.id, tripBody(vehicle.id, TEST_PRICE + 0.5));
    expect(above.status).toBe(400);
    expect(await above.json()).toEqual({ error: 'FUEL_PRICE_ABOVE_OFFICIAL', officialPrice: TEST_PRICE });

    expect((await call('POST', '/api/trips', host.id, tripBody(vehicle.id, TEST_PRICE))).status).toBe(201);
    expect((await call('POST', '/api/trips', host.id, tripBody(vehicle.id, 100))).status).toBe(201);
  });
});
```

The "no official price → old bounds" case is covered by `tripsAuth.test.js`, whose bound tests now run with the price mocked to `null`.

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx jest server/__tests__/adminFuelPrice.test.js`. Expected: FAIL (404 on `/api/fuel-price`).

- [ ] **Step 4: Implement** `server/services/fuelPriceService.js`

```js
const prisma = require('../config/db');

// Keep in sync with src/lib/constants.ts (the client-side copy for inline feedback).
const MIN_FUEL_PRICE_PER_LITER = 20;
const MAX_FUEL_PRICE_PER_LITER = 150;

function isValidFuelPrice(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= MIN_FUEL_PRICE_PER_LITER && n <= MAX_FUEL_PRICE_PER_LITER;
}

// The newest FuelPrice row is the official price; no rows means none is set.
async function getOfficialFuelPrice(client = prisma) {
  const row = await client.fuelPrice.findFirst({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  return row ? { pricePerLiter: row.pricePerLiter, updatedAt: row.createdAt } : null;
}

module.exports = { MIN_FUEL_PRICE_PER_LITER, MAX_FUEL_PRICE_PER_LITER, isValidFuelPrice, getOfficialFuelPrice };
```

- [ ] **Step 5: Implement** `server/controllers/fuelPriceController.js`

```js
const prisma = require('../config/db');
const { record } = require('../services/adminActionService');
const { decryptField } = require('../services/encryptionService');
const { getOfficialFuelPrice, isValidFuelPrice } = require('../services/fuelPriceService');

const HISTORY_LIMIT = 50;

async function getOfficial(req, res) {
  const official = await getOfficialFuelPrice();
  res.json({ official: official ? official.pricePerLiter : null, updatedAt: official ? official.updatedAt : null });
}

async function setOfficial(req, res) {
  const raw = req.body?.pricePerLiter;
  const price = typeof raw === 'number' ? raw : Number.NaN;
  if (!isValidFuelPrice(price)) return res.status(400).json({ error: 'INVALID_FUEL_PRICE' });

  const previous = await getOfficialFuelPrice();
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.fuelPrice.create({ data: { pricePerLiter: price, setById: req.user.id } });
    await record(tx, {
      actorId: req.user.id,
      action: 'FUEL_PRICE_SET',
      details: { from: previous ? previous.pricePerLiter : null, to: price },
    });
    return created;
  });
  res.json({ official: row.pricePerLiter, updatedAt: row.createdAt });
}

async function history(req, res) {
  const rows = await prisma.fuelPrice.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: HISTORY_LIMIT,
    include: { setBy: { select: { id: true, fullName: true } } },
  });
  res.json({
    history: rows.map((r) => ({
      id: r.id,
      pricePerLiter: r.pricePerLiter,
      createdAt: r.createdAt,
      setBy: { id: r.setBy.id, fullName: decryptField(r.setBy.fullName) },
    })),
  });
}

module.exports = { getOfficial, setOfficial, history };
```

The admin form always sends a JSON number, so the string `"abc"` and a missing value both fail `isValidFuelPrice`.

- [ ] **Step 6: Wire the routes and the cap**

- In `server/app.js`, after `app.get('/api/geocode', geocode);`:
  - add `app.get('/api/fuel-price', getOfficial);`
  - with `const { getOfficial } = require('./controllers/fuelPriceController');` at the top.
- In `server/routes/adminRoutes.js`:
  - add `const { setOfficial, history } = require('../controllers/fuelPriceController');`
  - add `router.put('/fuel-price', setOfficial);` and `router.get('/fuel-price/history', history);`.
- In `server/controllers/tripController.js`:
  - delete the local `MIN_FUEL_PRICE_PER_LITER` / `MAX_FUEL_PRICE_PER_LITER` constants and their comment.
  - add `const { MIN_FUEL_PRICE_PER_LITER, MAX_FUEL_PRICE_PER_LITER, getOfficialFuelPrice } = require('../services/fuelPriceService');`
  - inside `if (body.fuelPricePerLiter != null) { ... }`, after `body.fuelPricePerLiter = price;`, add:

```js
    const official = await getOfficialFuelPrice();
    if (official && price > official.pricePerLiter) {
      return res.status(400).json({ error: 'FUEL_PRICE_ABOVE_OFFICIAL', officialPrice: official.pricePerLiter });
    }
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npx jest server/__tests__/adminFuelPrice.test.js server/__tests__/tripsAuth.test.js`. Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add server/services/fuelPriceService.js server/controllers/fuelPriceController.js server/controllers/tripController.js server/routes/adminRoutes.js server/app.js server/__tests__/adminFuelPrice.test.js server/__tests__/tripsAuth.test.js
git commit -m "feat: add admin-set official fuel price as a cap on trip posting"
```

---

### Task 4: Bans, promotion, user search and detail; audit the automatic ladder

**Files:**
- Create: `server/services/adminModerationService.js`, `server/controllers/admin/userController.js`
- Modify: `server/routes/adminRoutes.js`, `server/services/reportEnforcementService.js:115-125`, `server/__tests__/reports.test.js`
- Test: `server/__tests__/adminUsers.test.js`

**Interfaces:**
- Consumes: `record` (Task 1); `PERMANENT_BAN_UNTIL`, `CATEGORY_LABELS` from `reportEnforcementService`; `sendBanNotificationEmail`.
- Produces:
  - `AdminError(status, code)` and `normalizeNote(note, { required }) → string | null`
  - `banUser(tx, { actorId, targetId, duration, reason, note?, reportId? }) → { email, bannedUntil, permanent, reason }`
  - `notifyBan(result)`
  - `unbanUser(tx, { actorId, targetId, note? })`
  - `setAdmin(tx, { actorId, targetId, makeAdmin })`
  - `sendAdminError(res, err)`
  - endpoints: `GET /api/admin/users?q=` → `{ users }`; `GET /api/admin/users/:id` → `{ user, hostedTrips, joinedMatches, ratings, reportsFiledCount, reportsReceived, banHistory }`; `POST .../ban|unban|promote|demote`

- [ ] **Step 1: Write the failing test** `server/__tests__/adminUsers.test.js`

```js
require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, cleanup } = require('../test-helpers/seed');

let server;
let base;
let dbUp = false;
const bag = newBag();
const ORIGINAL_SMTP_HOST = process.env.SMTP_HOST;

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  delete process.env.SMTP_HOST;
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
  if (ORIGINAL_SMTP_HOST === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = ORIGINAL_SMTP_HOST;
});

const guard = () => !dbUp;
const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? bearer(userId) : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

describe('user search and detail', () => {
  test('finds a user by name (decrypted) and by email', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const target = await makeUser(bag, { fullName: 'Zyxwv Searchable' });
    const byName = await (await call('GET', '/api/admin/users?q=zyxwv', admin.id)).json();
    expect(byName.users.map((u) => u.id)).toContain(target.id);
    const byEmail = await (await call('GET', `/api/admin/users?q=${encodeURIComponent(target.email)}`, admin.id)).json();
    expect(byEmail.users[0]).toMatchObject({ id: target.id, fullName: 'Zyxwv Searchable', isBanned: false });
  });

  test('detail returns the profile and its activity; unknown id → 404', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const target = await makeUser(bag, { fullName: 'Detail Target' });
    const res = await call('GET', `/api/admin/users/${target.id}`, admin.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ id: target.id, fullName: 'Detail Target', isAdmin: false });
    expect(body.user).not.toHaveProperty('passwordHash');
    for (const key of ['hostedTrips', 'joinedMatches', 'ratings', 'reportsReceived', 'banHistory']) {
      expect(Array.isArray(body[key])).toBe(true);
    }
    expect((await call('GET', '/api/admin/users/does-not-exist', admin.id)).status).toBe(404);
  });
});

describe('ban and unban', () => {
  test('ban locks the user out, is audited, and unban restores access', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const target = await makeUser(bag);

    const ban = await call('POST', `/api/admin/users/${target.id}/ban`, admin.id, { duration: '24H', reason: 'OTHER', note: 'Test' });
    expect(ban.status).toBe(200);
    const blocked = await call('GET', '/api/trips/mine', target.id);
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error).toBe('ACCOUNT_SUSPENDED');
    const saved = await prisma.user.findUnique({ where: { id: target.id }, select: { banReason: true, banSeverity: true } });
    expect(saved).toEqual({ banReason: 'OTHER', banSeverity: 'STANDARD' });
    expect(await prisma.adminAction.count({ where: { actorId: admin.id, targetUserId: target.id, action: 'BAN' } })).toBe(1);

    expect((await call('POST', `/api/admin/users/${target.id}/unban`, admin.id, { note: 'Appeal accepted' })).status).toBe(200);
    expect((await call('GET', '/api/trips/mine', target.id)).status).toBe(200);
    expect(await prisma.adminAction.count({ where: { targetUserId: target.id, action: 'UNBAN' } })).toBe(1);
  });

  test.each([
    [{ duration: '2Y', reason: 'OTHER' }, 400, 'INVALID_DURATION'],
    [{ duration: '24H', reason: 'BAD' }, 400, 'INVALID_REASON'],
    [{ duration: '24H', reason: 'OTHER', note: 'x'.repeat(501) }, 400, 'NOTE_TOO_LONG'],
  ])('rejects %p', async (body, status, code) => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const target = await makeUser(bag);
    const res = await call('POST', `/api/admin/users/${target.id}/ban`, admin.id, body);
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(code);
  });

  test('cannot ban yourself or another admin', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const other = await makeAdminUser(bag);
    const self = await call('POST', `/api/admin/users/${admin.id}/ban`, admin.id, { duration: '24H', reason: 'OTHER' });
    expect(self.status).toBe(400);
    expect((await self.json()).error).toBe('CANNOT_TARGET_SELF');
    const peer = await call('POST', `/api/admin/users/${other.id}/ban`, admin.id, { duration: '24H', reason: 'OTHER' });
    expect(peer.status).toBe(409);
    expect((await peer.json()).error).toBe('TARGET_IS_ADMIN');
  });
});

describe('promote and demote', () => {
  test('promote grants admin access; demote removes it on the next request', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const user = await makeUser(bag);

    expect((await call('POST', `/api/admin/users/${user.id}/promote`, admin.id)).status).toBe(200);
    expect((await call('GET', '/api/admin/overview', user.id)).status).toBe(200);
    const again = await call('POST', `/api/admin/users/${user.id}/promote`, admin.id);
    expect(again.status).toBe(409);
    expect((await again.json()).error).toBe('ALREADY_ADMIN');

    expect((await call('POST', `/api/admin/users/${user.id}/demote`, admin.id)).status).toBe(200);
    expect((await call('GET', '/api/admin/overview', user.id)).status).toBe(403);
    expect(await prisma.adminAction.count({ where: { targetUserId: user.id, action: { in: ['PROMOTE', 'DEMOTE'] } } })).toBe(2);
  });

  test('cannot demote yourself', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const res = await call('POST', `/api/admin/users/${admin.id}/demote`, admin.id);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('CANNOT_TARGET_SELF');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest server/__tests__/adminUsers.test.js`. Expected: FAIL (404s).

- [ ] **Step 3: Implement** `server/services/adminModerationService.js`

```js
const { record } = require('./adminActionService');
const { PERMANENT_BAN_UNTIL, CATEGORY_LABELS } = require('./reportEnforcementService');
const { sendBanNotificationEmail } = require('./emailService');

const HOUR_MS = 60 * 60 * 1000;
const BAN_DURATION_HOURS = { '24H': 24, '7D': 24 * 7, '30D': 24 * 30 };
const MAX_NOTE_LENGTH = 500;

class AdminError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function normalizeNote(note, { required = false } = {}) {
  const text = typeof note === 'string' ? note.trim() : '';
  if (!text) {
    if (required) throw new AdminError(400, 'NOTE_REQUIRED');
    return null;
  }
  if (text.length > MAX_NOTE_LENGTH) throw new AdminError(400, 'NOTE_TOO_LONG');
  return text;
}

function banUntilFor(duration, now = new Date()) {
  if (duration === 'PERMANENT') return PERMANENT_BAN_UNTIL;
  const hours = BAN_DURATION_HOURS[duration];
  return hours ? new Date(now.getTime() + hours * HOUR_MS) : null;
}

async function loadTarget(tx, actorId, targetId) {
  if (actorId === targetId) throw new AdminError(400, 'CANNOT_TARGET_SELF');
  const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, email: true, isAdmin: true } });
  if (!target) throw new AdminError(404, 'USER_NOT_FOUND');
  return target;
}

async function banUser(tx, { actorId, targetId, duration, reason, note = null, reportId = null }) {
  const bannedUntil = banUntilFor(duration);
  if (!bannedUntil) throw new AdminError(400, 'INVALID_DURATION');
  if (!CATEGORY_LABELS[reason]) throw new AdminError(400, 'INVALID_REASON');
  const cleanNote = normalizeNote(note);
  const target = await loadTarget(tx, actorId, targetId);
  if (target.isAdmin) throw new AdminError(409, 'TARGET_IS_ADMIN');

  const permanent = duration === 'PERMANENT';
  await tx.user.update({
    where: { id: targetId },
    data: { bannedUntil, banReason: reason, banSeverity: permanent ? 'HIGH_ALERT' : 'STANDARD' },
  });
  await record(tx, {
    actorId,
    action: 'BAN',
    targetUserId: targetId,
    targetReportId: reportId,
    details: { duration, reason, note: cleanNote, bannedUntil: bannedUntil.toISOString() },
  });
  return { email: target.email, bannedUntil, permanent, reason };
}

// Sent after the transaction commits, so a rolled-back ban never emails anyone.
function notifyBan({ email, bannedUntil, permanent, reason }) {
  return sendBanNotificationEmail(email, { categoryLabel: CATEGORY_LABELS[reason], permanent, bannedUntil });
}

async function unbanUser(tx, { actorId, targetId, note = null }) {
  const cleanNote = normalizeNote(note);
  await loadTarget(tx, actorId, targetId);
  await tx.user.update({ where: { id: targetId }, data: { bannedUntil: null, banReason: null, banSeverity: null } });
  await record(tx, { actorId, action: 'UNBAN', targetUserId: targetId, details: { note: cleanNote } });
}

async function setAdmin(tx, { actorId, targetId, makeAdmin }) {
  const target = await loadTarget(tx, actorId, targetId);
  if (target.isAdmin === makeAdmin) throw new AdminError(409, makeAdmin ? 'ALREADY_ADMIN' : 'NOT_ADMIN');
  await tx.user.update({ where: { id: targetId }, data: { isAdmin: makeAdmin } });
  await record(tx, { actorId, action: makeAdmin ? 'PROMOTE' : 'DEMOTE', targetUserId: targetId });
}

function sendAdminError(res, err) {
  if (err instanceof AdminError) return res.status(err.status).json({ error: err.code });
  throw err;
}

module.exports = { AdminError, normalizeNote, banUser, notifyBan, unbanUser, setAdmin, sendAdminError };
```

- [ ] **Step 4: Implement** `server/controllers/admin/userController.js`

```js
const prisma = require('../../config/db');
const safeUserSelect = require('../../config/safeUserSelect');
const { decryptField, decryptUserFields, decryptTripFields } = require('../../services/encryptionService');
const { banUser, notifyBan, unbanUser, setAdmin, sendAdminError } = require('../../services/adminModerationService');

const SEARCH_LIMIT = 50;
const DETAIL_LIMIT = 20;

// Names are AES-GCM with a random IV, so SQL can't match them — decrypt and
// filter in memory. One university's user count keeps this cheap.
async function searchUsers(req, res) {
  const q = String(req.query.q || '').trim().toLowerCase();
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, universityId: true, fullName: true, role: true, isAdmin: true, bannedUntil: true, avatarUrl: true, trustScore: true },
  });
  const now = new Date();
  const users = rows
    .map((u) => ({ ...u, fullName: decryptField(u.fullName), isBanned: u.bannedUntil != null && u.bannedUntil > now }))
    .filter((u) => !q || [u.email, u.universityId, u.fullName].some((field) => field.toLowerCase().includes(q)))
    .slice(0, SEARCH_LIMIT);
  res.json({ users });
}

async function getUserDetail(req, res) {
  const { id } = req.params;
  const userRaw = await prisma.user.findUnique({
    where: { id },
    select: { ...safeUserSelect, isAdmin: true, bannedUntil: true, banReason: true, banSeverity: true, createdAt: true },
  });
  if (!userRaw) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  const tripSelect = { id: true, destinationAddress: true, departureTime: true, status: true, filledSeats: true, totalSeats: true };
  const [hostedTrips, joinedMatches, ratings, reportsFiledCount, reportsReceived, banHistory] = await Promise.all([
    prisma.trip.findMany({ where: { hostId: id }, orderBy: { departureTime: 'desc' }, take: DETAIL_LIMIT, select: tripSelect }),
    prisma.match.findMany({
      where: { passengerId: id },
      orderBy: { createdAt: 'desc' },
      take: DETAIL_LIMIT,
      select: { id: true, status: true, createdAt: true, trip: { select: tripSelect } },
    }),
    prisma.rating.findMany({
      where: { rateeId: id },
      orderBy: { createdAt: 'desc' },
      take: DETAIL_LIMIT,
      select: { id: true, score: true, comment: true, createdAt: true },
    }),
    prisma.report.count({ where: { reporterId: id } }),
    prisma.report.findMany({
      where: { reportedUserId: id },
      orderBy: { createdAt: 'desc' },
      take: DETAIL_LIMIT,
      select: { id: true, category: true, status: true, description: true, createdAt: true },
    }),
    prisma.adminAction.findMany({
      where: { targetUserId: id, action: { in: ['BAN', 'UNBAN'] } },
      orderBy: { createdAt: 'desc' },
      take: DETAIL_LIMIT,
    }),
  ]);

  res.json({
    user: decryptUserFields(userRaw),
    hostedTrips: hostedTrips.map(decryptTripFields),
    joinedMatches: joinedMatches.map((m) => ({ ...m, trip: decryptTripFields(m.trip) })),
    ratings,
    reportsFiledCount,
    reportsReceived,
    banHistory,
  });
}

async function ban(req, res) {
  const { duration, reason, note } = req.body || {};
  try {
    const result = await prisma.$transaction((tx) =>
      banUser(tx, { actorId: req.user.id, targetId: req.params.id, duration, reason, note })
    );
    await notifyBan(result);
    return res.json({ status: 'BANNED', bannedUntil: result.bannedUntil });
  } catch (err) {
    return sendAdminError(res, err);
  }
}

async function unban(req, res) {
  try {
    await prisma.$transaction((tx) => unbanUser(tx, { actorId: req.user.id, targetId: req.params.id, note: req.body?.note }));
    return res.json({ status: 'UNBANNED' });
  } catch (err) {
    return sendAdminError(res, err);
  }
}

function adminToggle(makeAdmin) {
  return async (req, res) => {
    try {
      await prisma.$transaction((tx) => setAdmin(tx, { actorId: req.user.id, targetId: req.params.id, makeAdmin }));
      return res.json({ isAdmin: makeAdmin });
    } catch (err) {
      return sendAdminError(res, err);
    }
  };
}

module.exports = { searchUsers, getUserDetail, ban, unban, promote: adminToggle(true), demote: adminToggle(false) };
```

- [ ] **Step 5: Wire the routes**

In `server/routes/adminRoutes.js`:

```js
const users = require('../controllers/admin/userController');

router.get('/users', users.searchUsers);
router.get('/users/:id', users.getUserDetail);
router.post('/users/:id/ban', users.ban);
router.post('/users/:id/unban', users.unban);
router.post('/users/:id/promote', users.promote);
router.post('/users/:id/demote', users.demote);
```

- [ ] **Step 6: Audit the automatic ladder**

In `server/services/reportEnforcementService.js`:
- Add `const { record } = require('./adminActionService');`.
- Replace the single `await prisma.user.update({ ... })` inside `applyBanIfWarranted` with:

```js
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: reportedUserId },
      data: { bannedUntil: result.tier.until, banReason: triggeringCategory, banSeverity: result.tier.severity },
    });
    await record(tx, {
      action: 'BAN',
      targetUserId: reportedUserId,
      details: {
        automatic: true,
        reason: triggeringCategory,
        strikeCount: result.strikeCount,
        bannedUntil: result.tier.until.toISOString(),
      },
    });
  });
```

In `server/__tests__/reports.test.js`, find the first test that asserts the reported user is banned. After that assertion, add:

```js
    const audit = await prisma.adminAction.findFirst({ where: { targetUserId: target.id, action: 'BAN' } });
    expect(audit).toMatchObject({ actorId: null, details: expect.objectContaining({ automatic: true }) });
```

Use the reported user's variable name from that test in place of `target`.

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npx jest server/__tests__/adminUsers.test.js server/__tests__/reports.test.js`. Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add server/services/adminModerationService.js server/controllers/admin/userController.js server/routes/adminRoutes.js server/services/reportEnforcementService.js server/__tests__/adminUsers.test.js server/__tests__/reports.test.js
git commit -m "feat: add admin bans, promotion and user oversight endpoints"
```

---

### Task 5: Report review

**Files:**
- Create: `server/controllers/admin/reportController.js`
- Modify: `server/routes/adminRoutes.js`
- Test: `server/__tests__/adminReports.test.js`

**Interfaces:**
- Consumes: `record` (Task 1); `AdminError`, `normalizeNote`, `banUser`, `notifyBan`, `sendAdminError` (Task 4).
- Produces:
  - `GET /api/admin/reports?status=OPEN|REVIEWED|DISMISSED&cursor=` → `{ reports, nextCursor }`
  - `PATCH /api/admin/reports/:id` with body `{ status, note, ban?: { duration } }` → `{ status, banned }`

- [ ] **Step 1: Write the failing test** `server/__tests__/adminReports.test.js`

```js
require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

let server;
let base;
let dbUp = false;
const bag = newBag();
const ORIGINAL_SMTP_HOST = process.env.SMTP_HOST;

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  delete process.env.SMTP_HOST;
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
  if (ORIGINAL_SMTP_HOST === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = ORIGINAL_SMTP_HOST;
});

const guard = () => !dbUp;
const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? bearer(userId) : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

async function makeReport({ reportedIsAdmin = false } = {}) {
  const host = reportedIsAdmin ? await makeAdminUser(bag, { fullName: 'Reported Host' }) : await makeUser(bag, { fullName: 'Reported Host' });
  const passenger = await makeUser(bag, { fullName: 'Reporting Rider' });
  const vehicle = await makeVehicle(bag, host.id);
  const trip = await makeTrip(bag, host.id, vehicle.id);
  const match = await makeMatch(bag, trip.id, passenger.id);
  const report = await prisma.report.create({
    data: { reporterId: passenger.id, reportedUserId: host.id, reportedMatchId: match.id, category: 'NO_SHOW', description: 'Never came' },
  });
  return { host, passenger, report };
}

describe('GET /api/admin/reports', () => {
  test('lists open reports with decrypted names and the trip', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const { report } = await makeReport();
    const { reports } = await (await call('GET', '/api/admin/reports?status=OPEN', admin.id)).json();
    const mine = reports.find((r) => r.id === report.id);
    expect(mine).toMatchObject({
      category: 'NO_SHOW',
      status: 'OPEN',
      reporter: { fullName: 'Reporting Rider' },
      reportedUser: { fullName: 'Reported Host' },
    });
    expect(mine.trip.destinationAddress).toBe('Enverga University');
  });
});

describe('PATCH /api/admin/reports/:id', () => {
  test('dismiss records the reviewer and note; a second review → 409', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const { report } = await makeReport();
    const res = await call('PATCH', `/api/admin/reports/${report.id}`, admin.id, { status: 'DISMISSED', note: 'Not enough detail' });
    expect(res.status).toBe(200);
    const saved = await prisma.report.findUnique({ where: { id: report.id } });
    expect(saved).toMatchObject({ status: 'DISMISSED', reviewedById: admin.id, reviewNote: 'Not enough detail' });
    expect(await prisma.adminAction.count({ where: { targetReportId: report.id, action: 'REPORT_DISMISSED' } })).toBe(1);

    const again = await call('PATCH', `/api/admin/reports/${report.id}`, admin.id, { status: 'REVIEWED', note: 'x' });
    expect(again.status).toBe(409);
    expect((await again.json()).error).toBe('REPORT_ALREADY_RESOLVED');
  });

  test('review with a ban bans the reported user in the same step', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const { host, report } = await makeReport();
    const res = await call('PATCH', `/api/admin/reports/${report.id}`, admin.id, { status: 'REVIEWED', note: 'Confirmed', ban: { duration: '7D' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'REVIEWED', banned: true });
    const banned = await prisma.user.findUnique({ where: { id: host.id }, select: { banReason: true, bannedUntil: true } });
    expect(banned.banReason).toBe('NO_SHOW');
    expect(banned.bannedUntil > new Date()).toBe(true);
  });

  test('a failed ban rolls back the review', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const { report } = await makeReport({ reportedIsAdmin: true });
    const res = await call('PATCH', `/api/admin/reports/${report.id}`, admin.id, { status: 'REVIEWED', note: 'x', ban: { duration: '24H' } });
    expect(res.status).toBe(409);
    expect((await prisma.report.findUnique({ where: { id: report.id } })).status).toBe('OPEN');
  });

  test.each([
    [{ status: 'DONE', note: 'x' }, 400, 'INVALID_STATUS'],
    [{ status: 'REVIEWED' }, 400, 'NOTE_REQUIRED'],
    [{ status: 'DISMISSED', note: 'x', ban: { duration: '24H' } }, 400, 'BAN_REQUIRES_REVIEWED'],
  ])('rejects %p', async (body, status, code) => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const { report } = await makeReport();
    const res = await call('PATCH', `/api/admin/reports/${report.id}`, admin.id, body);
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(code);
  });

  test('unknown report → 404', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const res = await call('PATCH', '/api/admin/reports/nope', admin.id, { status: 'DISMISSED', note: 'x' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest server/__tests__/adminReports.test.js`. Expected: FAIL (404s).

- [ ] **Step 3: Implement** `server/controllers/admin/reportController.js`

```js
const prisma = require('../../config/db');
const { record } = require('../../services/adminActionService');
const { decryptField } = require('../../services/encryptionService');
const { AdminError, normalizeNote, banUser, notifyBan, sendAdminError } = require('../../services/adminModerationService');

const PAGE_SIZE = 20;
const STATUSES = ['OPEN', 'REVIEWED', 'DISMISSED'];
const PERSON = { id: true, fullName: true, email: true, trustScore: true, bannedUntil: true };

const person = (p) => (p ? { ...p, fullName: decryptField(p.fullName) } : null);

async function listReports(req, res) {
  const status = STATUSES.includes(req.query.status) ? req.query.status : 'OPEN';
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const rows = await prisma.report.findMany({
    where: { status },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      reporter: { select: PERSON },
      reportedUser: { select: PERSON },
      reviewedBy: { select: { id: true, fullName: true } },
      reportedMatch: { select: { trip: { select: { id: true, destinationAddress: true, departureTime: true } } } },
    },
  });
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const reports = page.map(({ reportedMatch, reporter, reportedUser, reviewedBy, ...r }) => {
    const trip = reportedMatch?.trip;
    return {
      ...r,
      reporter: person(reporter),
      reportedUser: person(reportedUser),
      reviewedBy: person(reviewedBy),
      trip: trip ? { ...trip, destinationAddress: decryptField(trip.destinationAddress) } : null,
    };
  });
  res.json({ reports, nextCursor: hasMore ? page[page.length - 1].id : null });
}

async function reviewReport(req, res) {
  const { status, note, ban } = req.body || {};
  if (status !== 'REVIEWED' && status !== 'DISMISSED') return res.status(400).json({ error: 'INVALID_STATUS' });
  if (ban && status !== 'REVIEWED') return res.status(400).json({ error: 'BAN_REQUIRES_REVIEWED' });

  try {
    const reviewNote = normalizeNote(note, { required: true });
    const banResult = await prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({ where: { id: req.params.id } });
      if (!report) throw new AdminError(404, 'REPORT_NOT_FOUND');
      // Conditional write, so two admins resolving the same report can't both win.
      const { count } = await tx.report.updateMany({
        where: { id: report.id, status: 'OPEN' },
        data: { status, reviewedById: req.user.id, reviewedAt: new Date(), reviewNote },
      });
      if (count === 0) throw new AdminError(409, 'REPORT_ALREADY_RESOLVED');
      await record(tx, {
        actorId: req.user.id,
        action: status === 'REVIEWED' ? 'REPORT_REVIEWED' : 'REPORT_DISMISSED',
        targetUserId: report.reportedUserId,
        targetReportId: report.id,
        details: { note: reviewNote },
      });
      if (!ban) return null;
      if (!report.reportedUserId) throw new AdminError(400, 'NO_REPORTED_USER');
      return banUser(tx, {
        actorId: req.user.id,
        targetId: report.reportedUserId,
        duration: ban.duration,
        reason: report.category,
        note: reviewNote,
        reportId: report.id,
      });
    });
    if (banResult) await notifyBan(banResult);
    return res.json({ status, banned: Boolean(banResult) });
  } catch (err) {
    return sendAdminError(res, err);
  }
}

module.exports = { listReports, reviewReport };
```

- [ ] **Step 4: Wire the routes**

In `server/routes/adminRoutes.js`:

```js
const reports = require('../controllers/admin/reportController');

router.get('/reports', reports.listReports);
router.patch('/reports/:id', reports.reviewReport);
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx jest server/__tests__/adminReports.test.js`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/admin/reportController.js server/routes/adminRoutes.js server/__tests__/adminReports.test.js
git commit -m "feat: add admin report review with optional ban"
```

---

### Task 6: Shared trip cancellation and admin cancel

**Files:**
- Create: `server/services/tripCancellationService.js`, `server/controllers/admin/tripController.js`
- Modify: `server/controllers/tripController.js` (host branch of `cancelTrip`), `server/routes/adminRoutes.js`
- Test: `server/__tests__/adminTrips.test.js`

**Interfaces:**
- Consumes: `record` (Task 1).
- Produces:
  - `cancelWholeTrip(tx, trip, { reason, byAdmin }) → Promise<number>`, the count of affected matches. `trip` is decrypted and includes `matches`.
  - `ADMIN_CANCEL_PREFIX`
  - `PATCH /api/admin/trips/:id/cancel` with body `{ reason }` → `{ status: 'TRIP_CANCELLED', affectedMatches }`

- [ ] **Step 1: Write the failing test** `server/__tests__/adminTrips.test.js`

```js
require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

let server;
let base;
let dbUp = false;
const bag = newBag();

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;
const cancel = (tripId, userId, body) =>
  fetch(`${base}/api/admin/trips/${tripId}/cancel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: JSON.stringify(body),
  });

describe('PATCH /api/admin/trips/:id/cancel', () => {
  test('cancels the trip and active matches, notifies host and passengers, and audits it', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const host = await makeUser(bag);
    const approved = await makeUser(bag);
    const pending = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    await makeMatch(bag, trip.id, approved.id, { status: 'APPROVED' });
    await makeMatch(bag, trip.id, pending.id);

    const res = await cancel(trip.id, admin.id, { reason: 'Unsafe vehicle reported' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'TRIP_CANCELLED', affectedMatches: 2 });

    const saved = await prisma.trip.findUnique({ where: { id: trip.id }, include: { matches: true } });
    expect(saved.status).toBe('CANCELLED');
    expect(saved.cancelReason).toBe('Cancelled by an administrator: Unsafe vehicle reported');
    expect(saved.matches.every((m) => m.status === 'CANCELLED')).toBe(true);

    const notes = await prisma.notification.findMany({ where: { relatedTripId: trip.id, type: 'CANCELLATION' } });
    expect(notes.map((n) => n.userId).sort()).toEqual([approved.id, host.id, pending.id].sort());
    expect(notes.every((n) => n.message.includes('An administrator cancelled'))).toBe(true);

    const audit = await prisma.adminAction.findFirst({ where: { targetTripId: trip.id, action: 'TRIP_CANCELLED' } });
    expect(audit).toMatchObject({ actorId: admin.id, targetUserId: host.id });

    expect((await cancel(trip.id, admin.id, { reason: 'again' })).status).toBe(409);
  });

  test('requires a reason and an admin', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const host = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    const missing = await cancel(trip.id, admin.id, {});
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe('NOTE_REQUIRED');
    expect((await cancel(trip.id, host.id, { reason: 'x' })).status).toBe(403);
    expect((await cancel('nope', admin.id, { reason: 'x' })).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest server/__tests__/adminTrips.test.js`. Expected: FAIL (404).

- [ ] **Step 3: Implement** `server/services/tripCancellationService.js`

```js
const ACTIVE_MATCH_STATUSES = ['PENDING', 'APPROVED'];
const ADMIN_CANCEL_PREFIX = 'Cancelled by an administrator: ';

function passengerMessage(trip, reason, byAdmin) {
  if (byAdmin) return `An administrator cancelled the trip to ${trip.destinationAddress}: ${reason}`;
  return reason
    ? `Host cancelled: ${reason} (trip to ${trip.destinationAddress})`
    : `Your host cancelled the trip to ${trip.destinationAddress}.`;
}

// Cancels the whole trip and every active match, and notifies each affected
// passenger. `trip` must be decrypted and include `matches`.
async function cancelWholeTrip(tx, trip, { reason, byAdmin = false }) {
  const affected = trip.matches.filter((m) => ACTIVE_MATCH_STATUSES.includes(m.status));
  await tx.trip.update({
    where: { id: trip.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: byAdmin ? `${ADMIN_CANCEL_PREFIX}${reason}` : reason || null,
    },
  });
  for (const m of affected) {
    await tx.match.update({ where: { id: m.id }, data: { status: 'CANCELLED' } });
    await tx.notification.create({
      data: {
        userId: m.passengerId,
        type: 'CANCELLATION',
        message: passengerMessage(trip, reason, byAdmin),
        relatedMatchId: m.id,
        relatedTripId: trip.id,
      },
    });
  }
  return affected.length;
}

module.exports = { cancelWholeTrip, ACTIVE_MATCH_STATUSES, ADMIN_CANCEL_PREFIX };
```

- [ ] **Step 4: Use it in the host path**

In `server/controllers/tripController.js`:
- Add `const { cancelWholeTrip, ACTIVE_MATCH_STATUSES } = require('../services/tripCancellationService');`.
- In `cancelTrip`, delete the local `const ACTIVE_MATCH_STATUSES = [...]`.
- Replace the whole `if (userId === trip.hostId) { ... }` block with:

```js
  if (userId === trip.hostId) {
    const affectedMatches = await prisma.$transaction((tx) => cancelWholeTrip(tx, trip, { reason }));
    return res.json({ status: 'TRIP_CANCELLED', affectedMatches });
  }
```

- [ ] **Step 5: Implement** `server/controllers/admin/tripController.js`

```js
const prisma = require('../../config/db');
const { record } = require('../../services/adminActionService');
const { decryptTripFields } = require('../../services/encryptionService');
const { normalizeNote, sendAdminError } = require('../../services/adminModerationService');
const { cancelWholeTrip } = require('../../services/tripCancellationService');

async function cancelTripAsAdmin(req, res) {
  let reason;
  try {
    reason = normalizeNote(req.body?.reason, { required: true });
  } catch (err) {
    return sendAdminError(res, err);
  }

  const tripRaw = await prisma.trip.findUnique({ where: { id: req.params.id }, include: { matches: true } });
  if (!tripRaw) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (tripRaw.status === 'CANCELLED' || tripRaw.status === 'COMPLETED') {
    return res.status(409).json({ error: 'TRIP_NOT_CANCELLABLE' });
  }
  const trip = decryptTripFields(tripRaw);

  const affectedMatches = await prisma.$transaction(async (tx) => {
    const count = await cancelWholeTrip(tx, trip, { reason, byAdmin: true });
    await tx.notification.create({
      data: {
        userId: trip.hostId,
        type: 'CANCELLATION',
        message: `An administrator cancelled your trip to ${trip.destinationAddress}: ${reason}`,
        relatedTripId: trip.id,
      },
    });
    await record(tx, {
      actorId: req.user.id,
      action: 'TRIP_CANCELLED',
      targetUserId: trip.hostId,
      targetTripId: trip.id,
      details: { reason, affectedMatches: count },
    });
    return count;
  });
  res.json({ status: 'TRIP_CANCELLED', affectedMatches });
}

module.exports = { cancelTripAsAdmin };
```

- [ ] **Step 6: Wire the route**

In `server/routes/adminRoutes.js`: add `const { cancelTripAsAdmin } = require('../controllers/admin/tripController');` and `router.patch('/trips/:id/cancel', cancelTripAsAdmin);`.

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npx jest server/__tests__/adminTrips.test.js server/__tests__/tripsAuth.test.js`. Expected: all pass, including the existing host-cancel tests.

- [ ] **Step 8: Commit**

```bash
git add server/services/tripCancellationService.js server/controllers/admin/tripController.js server/controllers/tripController.js server/routes/adminRoutes.js server/__tests__/adminTrips.test.js
git commit -m "feat: let admins cancel trips via a shared cancellation service"
```

---

### Task 7: Admin shell, overview and activity pages

**Files:**
- Create: `src/lib/admin.ts`, `src/app/auth/admin/layout.tsx`, `src/app/auth/admin/AdminNav.tsx`, `src/app/auth/admin/page.tsx`, `src/app/auth/admin/activity/page.tsx`
- Modify: `src/lib/session.ts` (`CurrentUser.isAdmin?: boolean`), `src/app/auth/profile/ProfileClient.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/overview`, `GET /api/admin/actions` (Task 2).
- Produces: types `AdminAction` and `AdminCounts`, plus `actionLabel(action)`, `formatDateTime(iso)`, `BAN_DURATION_OPTIONS` and `CATEGORY_OPTIONS` in `src/lib/admin.ts`.

- [ ] **Step 1: Add** `src/lib/admin.ts`

```ts
export interface AdminAction {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: 'BAN' | 'UNBAN' | 'REPORT_REVIEWED' | 'REPORT_DISMISSED' | 'TRIP_CANCELLED' | 'FUEL_PRICE_SET' | 'PROMOTE' | 'DEMOTE';
  targetUserId: string | null;
  targetUserName: string | null;
  targetTripId: string | null;
  targetReportId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminCounts {
  users: number;
  admins: number;
  openTrips: number;
  completedTrips: number;
  pendingRequests: number;
  openReports: number;
  activeBans: number;
}

const ACTION_LABELS: Record<AdminAction['action'], string> = {
  BAN: 'Banned',
  UNBAN: 'Unbanned',
  REPORT_REVIEWED: 'Reviewed a report on',
  REPORT_DISMISSED: 'Dismissed a report on',
  TRIP_CANCELLED: 'Cancelled a trip by',
  FUEL_PRICE_SET: 'Set the official fuel price',
  PROMOTE: 'Made admin:',
  DEMOTE: 'Removed admin:',
};

export function actionLabel(action: AdminAction['action']): string {
  return ACTION_LABELS[action];
}

export function describeAction(a: AdminAction): string {
  const actor = a.actorName ?? (a.details?.automatic ? 'Automatic ladder' : 'System');
  if (a.action === 'FUEL_PRICE_SET') return `${actor} set the official fuel price to ₱${Number(a.details?.to).toFixed(2)}/L`;
  return `${actor} · ${actionLabel(a.action)} ${a.targetUserName ?? ''}`.trim();
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
}

export const BAN_DURATION_OPTIONS = [
  { value: '24H', label: '24 hours' },
  { value: '7D', label: '7 days' },
  { value: '30D', label: '30 days' },
  { value: 'PERMANENT', label: 'Permanent' },
] as const;

export const CATEGORY_OPTIONS = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'NO_SHOW', label: 'No-show' },
  { value: 'INAPPROPRIATE_BEHAVIOR', label: 'Inappropriate behavior' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'SAFETY', label: 'Safety concern' },
  { value: 'OTHER', label: 'Other' },
] as const;
```

- [ ] **Step 2: Expose `isAdmin` to the UI**

In `src/lib/session.ts`, add `isAdmin?: boolean;` to `CurrentUser`.

In `src/app/auth/profile/ProfileClient.tsx`:
- Import `Link` from `next/link` and `FaUserShield` from `react-icons/fa`.
- Insert this card before the "Privacy & Safety" `<Card>`:

```tsx
        {user.isAdmin && (
          <Card>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Administration</h3>
            <Link
              href="/auth/admin"
              className="flex items-center gap-2 text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline mt-2"
            >
              <FaUserShield className="w-4 h-4" />
              Open admin console
            </Link>
            <p className="text-[11px] text-gray-400 mt-1">Reports, bans, users, trips and the official fuel price</p>
          </Card>
        )}
```

- [ ] **Step 3: Layout and nav**

Create `src/app/auth/admin/layout.tsx`:

```tsx
import React from 'react';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getCurrentUser } from '@/lib/session';
import AdminNav from './AdminNav';

// Hides the admin area from everyone else. The API's requireAdmin is the real guard.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="profile" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Admin console</h1>
          <p className="text-sm text-gray-500 mt-0.5">Safety, moderation and system settings</p>
        </div>
        <AdminNav />
        <div className="mt-4">{children}</div>
      </main>
      <BottomNav active="profile" />
    </div>
  );
}
```

Create `src/app/auth/admin/AdminNav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/auth/admin', label: 'Overview' },
  { href: '/auth/admin/reports', label: 'Reports' },
  { href: '/auth/admin/users', label: 'Users' },
  { href: '/auth/admin/fuel-price', label: 'Fuel price' },
  { href: '/auth/admin/activity', label: 'Activity' },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Admin sections">
      {TABS.map((tab) => {
        const active = tab.href === '/auth/admin' ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${
              active ? 'border-[color:var(--rsu-color-primary)] text-[color:var(--rsu-color-primary)]' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Overview page** `src/app/auth/admin/page.tsx`

```tsx
import Link from 'next/link';
import Card from '@/components/Card';
import { apiFetch } from '@/lib/api-server';
import { describeAction, formatDateTime, type AdminAction, type AdminCounts } from '@/lib/admin';

const TILES: { key: keyof AdminCounts; label: string }[] = [
  { key: 'users', label: 'Users' },
  { key: 'openTrips', label: 'Open trips' },
  { key: 'completedTrips', label: 'Completed trips' },
  { key: 'pendingRequests', label: 'Pending requests' },
  { key: 'openReports', label: 'Open reports' },
  { key: 'activeBans', label: 'Active bans' },
  { key: 'admins', label: 'Admins' },
];

export default async function AdminOverviewPage() {
  const { counts, recentActions } = await apiFetch<{ counts: AdminCounts; recentActions: AdminAction[] }>('/api/admin/overview');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TILES.map((t) => (
          <Card key={t.key} className="!p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t.label}</p>
            <p className="text-2xl font-extrabold text-gray-900 tabular-nums mt-1">{counts[t.key]}</p>
          </Card>
        ))}
      </div>

      {counts.openReports > 0 && (
        <Link href="/auth/admin/reports" className="block rsu-card !p-4 text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
          {counts.openReports} open report{counts.openReports === 1 ? '' : 's'} waiting for review →
        </Link>
      )}

      <Card>
        <h2 className="text-sm font-bold text-gray-900 mb-3">Recent admin activity</h2>
        {recentActions.length === 0 ? (
          <p className="text-sm text-gray-500">No admin actions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentActions.map((a) => (
              <li key={a.id} className="py-2 flex flex-col md:flex-row md:justify-between gap-0.5">
                <span className="text-sm text-gray-800">{describeAction(a)}</span>
                <span className="text-xs text-gray-400">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/auth/admin/activity" className="inline-block mt-3 text-xs font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
          View full activity log
        </Link>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Activity page** `src/app/auth/admin/activity/page.tsx`

```tsx
import Link from 'next/link';
import Card from '@/components/Card';
import { apiFetch } from '@/lib/api-server';
import { describeAction, formatDateTime, type AdminAction } from '@/lib/admin';

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { actions, nextCursor } = await apiFetch<{ actions: AdminAction[]; nextCursor: string | null }>(`/api/admin/actions${query}`);

  return (
    <Card>
      <h2 className="text-sm font-bold text-gray-900 mb-3">Activity log</h2>
      {actions.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing recorded yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {actions.map((a) => (
            <li key={a.id} className="py-2">
              <p className="text-sm text-gray-800">{describeAction(a)}</p>
              {typeof a.details?.note === 'string' && <p className="text-xs text-gray-500 mt-0.5">“{a.details.note}”</p>}
              {typeof a.details?.reason === 'string' && a.action === 'TRIP_CANCELLED' && (
                <p className="text-xs text-gray-500 mt-0.5">Reason: {a.details.reason}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(a.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-4 mt-3 text-xs font-semibold">
        {cursor && <Link href="/auth/admin/activity" className="text-[color:var(--rsu-color-primary)] hover:underline">Newest</Link>}
        {nextCursor && (
          <Link href={`/auth/admin/activity?cursor=${nextCursor}`} className="text-[color:var(--rsu-color-primary)] hover:underline">Older →</Link>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 6: Verify in the browser**

1. Run `npm run make-admin <a dev account email>` and log in as that account.
2. Open `/auth/profile`. Confirm the "Administration" card is there and that it's absent for a non-admin.
3. Open `/auth/admin` and `/auth/admin/activity` at 375 px and at desktop width, in both themes.
4. As a non-admin, `/auth/admin` must show a 404.
5. Run `npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin.ts src/lib/session.ts src/app/auth/profile/ProfileClient.tsx src/app/auth/admin/layout.tsx src/app/auth/admin/AdminNav.tsx src/app/auth/admin/page.tsx src/app/auth/admin/activity/page.tsx
git commit -m "feat: add admin console shell, overview and activity log"
```

---

### Task 8: Reports review page

**Files:**
- Create: `src/app/auth/admin/reports/page.tsx`, `src/app/auth/admin/reports/ReportCard.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/admin/reports`, `PATCH /api/admin/reports/:id` (Task 5)
  - `BAN_DURATION_OPTIONS`, `formatDateTime` (Task 7)
  - `reportCategoryLabel` from `src/lib/format.ts`

- [ ] **Step 1: Page** `src/app/auth/admin/reports/page.tsx`

```tsx
import Link from 'next/link';
import { apiFetch } from '@/lib/api-server';
import ReportCard, { type AdminReport } from './ReportCard';

const STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'OPEN' } = await searchParams;
  const { reports } = await apiFetch<{ reports: AdminReport[] }>(`/api/admin/reports?status=${encodeURIComponent(status)}`);

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="tablist" aria-label="Report status">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/auth/admin/reports?status=${s.value}`}
            role="tab"
            aria-selected={status === s.value}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              status === s.value ? 'bg-[color:var(--rsu-color-primary)] text-white border-transparent' : 'border-gray-300 text-gray-600'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>
      {reports.length === 0 ? (
        <p className="rsu-card text-sm text-gray-500">No {status.toLowerCase()} reports.</p>
      ) : (
        reports.map((r) => <ReportCard key={r.id} report={r} />)
      )}
    </div>
  );
}
```

- [ ] **Step 2: Card with review actions** `src/app/auth/admin/reports/ReportCard.tsx`

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { apiFetch, ApiError } from '@/lib/api';
import { reportCategoryLabel } from '@/lib/format';
import { BAN_DURATION_OPTIONS, formatDateTime } from '@/lib/admin';

interface Person { id: string; fullName: string; email: string; trustScore: number }

export interface AdminReport {
  id: string;
  category: string;
  description: string | null;
  status: 'OPEN' | 'REVIEWED' | 'DISMISSED';
  createdAt: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  reporter: Person;
  reportedUser: Person | null;
  reviewedBy: { id: string; fullName: string } | null;
  trip: { id: string; destinationAddress: string; departureTime: string } | null;
}

const ERRORS: Record<string, string> = {
  NOTE_REQUIRED: 'Write a short note explaining the decision.',
  NOTE_TOO_LONG: 'Keep the note under 500 characters.',
  REPORT_ALREADY_RESOLVED: 'Another admin already resolved this report. Refresh the list.',
  TARGET_IS_ADMIN: 'This user is an admin. Remove their admin role before banning them.',
};

export default function ReportCard({ report }: { report: AdminReport }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [banDuration, setBanDuration] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(status: 'REVIEWED' | 'DISMISSED') {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/reports/${report.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note, ...(status === 'REVIEWED' && banDuration ? { ban: { duration: banDuration } } : {}) }),
      });
      router.refresh();
    } catch (err) {
      setError((err instanceof ApiError && err.code && ERRORS[err.code]) || 'Couldn’t save that decision. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="warning">{reportCategoryLabel(report.category)}</Badge>
        <span className="text-xs text-gray-400">{formatDateTime(report.createdAt)}</span>
      </div>
      <p className="text-sm text-gray-800 mt-2">
        <span className="font-semibold">{report.reporter.fullName}</span> reported{' '}
        {report.reportedUser ? (
          <Link href={`/auth/admin/users/${report.reportedUser.id}`} className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
            {report.reportedUser.fullName}
          </Link>
        ) : (
          'a user'
        )}
      </p>
      {report.trip && <p className="text-xs text-gray-500 mt-0.5">Trip to {report.trip.destinationAddress} · {formatDateTime(report.trip.departureTime)}</p>}
      {report.description && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">“{report.description}”</p>}

      {report.status === 'OPEN' ? (
        <div className="mt-3 space-y-2">
          <label htmlFor={`note-${report.id}`} className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Decision note</label>
          <textarea
            id={`note-${report.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
          />
          <label htmlFor={`ban-${report.id}`} className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Ban the reported user (optional)</label>
          <select
            id={`ban-${report.id}`}
            value={banDuration}
            onChange={(e) => setBanDuration(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm"
          >
            <option value="">No ban</option>
            {BAN_DURATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => resolve('REVIEWED')} className="rsu-btn-primary flex-1 disabled:opacity-60">
              {banDuration ? 'Review and ban' : 'Mark reviewed'}
            </button>
            <button type="button" disabled={busy || Boolean(banDuration)} onClick={() => resolve('DISMISSED')} className="rsu-btn-secondary flex-1 disabled:opacity-60">
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mt-3">
          {report.status === 'REVIEWED' ? 'Reviewed' : 'Dismissed'} by {report.reviewedBy?.fullName ?? 'an admin'}
          {report.reviewedAt ? ` · ${formatDateTime(report.reviewedAt)}` : ''}
          {report.reviewNote ? ` — “${report.reviewNote}”` : ''}
        </p>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Verify in the browser**

1. File a report between two dev accounts.
2. As an admin, open `/auth/admin/reports`. Confirm that dismissing without a note shows "Write a short note…".
3. Dismiss with a note, and confirm the report moves to the Dismissed tab.
4. Review another report with a 24-hour ban, and confirm the banned account sees the suspended screen.
5. Check the page at 375 px and at desktop width, in both themes.
6. Run `npx tsc --noEmit`.

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/admin/reports
git commit -m "feat: add admin report review page"
```

---

### Task 9: Users search and detail pages

**Files:**
- Create: `src/app/auth/admin/users/page.tsx`, `src/app/auth/admin/users/[id]/page.tsx`, `src/app/auth/admin/users/[id]/UserActions.tsx`, `src/app/auth/admin/users/[id]/CancelTripButton.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/admin/users`, `GET /api/admin/users/:id`, and `POST .../ban|unban|promote|demote` (Task 4)
  - `PATCH /api/admin/trips/:id/cancel` (Task 6)
  - `BAN_DURATION_OPTIONS`, `CATEGORY_OPTIONS`, `formatDateTime` (Task 7)

- [ ] **Step 1: Search page** `src/app/auth/admin/users/page.tsx`

```tsx
import Link from 'next/link';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { apiFetch } from '@/lib/api-server';

interface AdminUserRow {
  id: string;
  email: string;
  universityId: string;
  fullName: string;
  role: string;
  isAdmin: boolean;
  isBanned: boolean;
  trustScore: number;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const { users } = await apiFetch<{ users: AdminUserRow[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`);

  return (
    <div className="space-y-3">
      <form action="/auth/admin/users" className="flex gap-2" role="search">
        <label htmlFor="admin-user-search" className="sr-only">Search users</label>
        <input
          id="admin-user-search"
          name="q"
          defaultValue={q}
          placeholder="Name, email or university ID"
          className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
        />
        <button type="submit" className="rsu-btn-primary">Search</button>
      </form>
      <Card className="!p-0">
        {users.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No users match “{q}”.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {users.map((u) => (
              <li key={u.id}>
                <Link href={`/auth/admin/users/${u.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 truncate">{u.fullName}</span>
                    <span className="block text-xs text-gray-500 truncate">{u.email}</span>
                  </span>
                  <span className="flex gap-1 shrink-0">
                    {u.isAdmin && <Badge tone="primary">Admin</Badge>}
                    {u.isBanned && <Badge tone="warning">Banned</Badge>}
                    <Badge tone="neutral">{u.role.toLowerCase()}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Detail page** `src/app/auth/admin/users/[id]/page.tsx`

```tsx
import { notFound } from 'next/navigation';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { apiFetch } from '@/lib/api-server';
import { ApiError } from '@/lib/api';
import { reportCategoryLabel } from '@/lib/format';
import { formatDateTime, type AdminAction } from '@/lib/admin';
import UserActions from './UserActions';
import CancelTripButton from './CancelTripButton';

interface TripRow { id: string; destinationAddress: string; departureTime: string; status: string; filledSeats: number; totalSeats: number }

interface UserDetail {
  user: {
    id: string; email: string; fullName: string; role: string; universityId: string; trustScore: number;
    tripCount: number; isAdmin: boolean; bannedUntil: string | null; banReason: string | null; createdAt: string;
  };
  hostedTrips: TripRow[];
  joinedMatches: { id: string; status: string; createdAt: string; trip: TripRow }[];
  ratings: { id: string; score: number; comment: string | null; createdAt: string }[];
  reportsFiledCount: number;
  reportsReceived: { id: string; category: string; status: string; description: string | null; createdAt: string }[];
  banHistory: AdminAction[];
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data: UserDetail;
  try {
    data = await apiFetch<UserDetail>(`/api/admin/users/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const { user, hostedTrips, joinedMatches, ratings, reportsFiledCount, reportsReceived, banHistory } = data;
  const banned = user.bannedUntil != null && new Date(user.bannedUntil) > new Date();

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">{user.fullName}</h2>
          {user.isAdmin && <Badge tone="primary">Admin</Badge>}
          {banned && <Badge tone="warning">Banned until {formatDateTime(user.bannedUntil!)}</Badge>}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
          <dt className="text-gray-500">Email</dt><dd className="text-gray-900 break-all">{user.email}</dd>
          <dt className="text-gray-500">University ID</dt><dd className="text-gray-900">{user.universityId}</dd>
          <dt className="text-gray-500">Role</dt><dd className="text-gray-900">{user.role.toLowerCase()}</dd>
          <dt className="text-gray-500">Trust score</dt><dd className="text-gray-900 tabular-nums">{user.trustScore.toFixed(2)} ({user.tripCount} ratings)</dd>
          <dt className="text-gray-500">Joined</dt><dd className="text-gray-900">{formatDateTime(user.createdAt)}</dd>
          <dt className="text-gray-500">Reports filed</dt><dd className="text-gray-900 tabular-nums">{reportsFiledCount}</dd>
        </dl>
        <UserActions userId={user.id} isAdmin={user.isAdmin} isBanned={banned} />
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Trips hosted</h3>
        {hostedTrips.length === 0 ? <p className="text-sm text-gray-500">None.</p> : (
          <ul className="divide-y divide-gray-100">
            {hostedTrips.map((t) => (
              <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-sm text-gray-800 min-w-0">
                  To {t.destinationAddress}
                  <span className="block text-xs text-gray-500">{formatDateTime(t.departureTime)} · {t.status.toLowerCase()} · {t.filledSeats}/{t.totalSeats} seats</span>
                </span>
                {(t.status === 'OPEN' || t.status === 'FULL') && <CancelTripButton tripId={t.id} />}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Rides joined</h3>
        {joinedMatches.length === 0 ? <p className="text-sm text-gray-500">None.</p> : (
          <ul className="divide-y divide-gray-100">
            {joinedMatches.map((m) => (
              <li key={m.id} className="py-2 text-sm text-gray-800">
                To {m.trip.destinationAddress}
                <span className="block text-xs text-gray-500">{formatDateTime(m.trip.departureTime)} · request {m.status.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Reports against this user</h3>
        {reportsReceived.length === 0 ? <p className="text-sm text-gray-500">None.</p> : (
          <ul className="divide-y divide-gray-100">
            {reportsReceived.map((r) => (
              <li key={r.id} className="py-2 text-sm text-gray-800">
                {reportCategoryLabel(r.category)} · {r.status.toLowerCase()}
                {r.description && <span className="block text-xs text-gray-500">“{r.description}”</span>}
                <span className="block text-xs text-gray-400">{formatDateTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Ratings received</h3>
        {ratings.length === 0 ? <p className="text-sm text-gray-500">None.</p> : (
          <ul className="divide-y divide-gray-100">
            {ratings.map((r) => (
              <li key={r.id} className="py-2 text-sm text-gray-800">
                {'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}
                {r.comment && <span className="block text-xs text-gray-500">“{r.comment}”</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Ban history</h3>
        {banHistory.length === 0 ? <p className="text-sm text-gray-500">Never banned.</p> : (
          <ul className="divide-y divide-gray-100">
            {banHistory.map((a) => (
              <li key={a.id} className="py-2 text-sm text-gray-800">
                {a.action === 'BAN' ? `Banned (${String(a.details?.duration ?? a.details?.reason ?? '')})` : 'Unbanned'}
                {' '}by {a.actorId ? 'an admin' : 'the automatic ladder'}
                <span className="block text-xs text-gray-400">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Actions** `src/app/auth/admin/users/[id]/UserActions.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { BAN_DURATION_OPTIONS, CATEGORY_OPTIONS } from '@/lib/admin';

const ERRORS: Record<string, string> = {
  CANNOT_TARGET_SELF: 'You can’t do that to your own account.',
  TARGET_IS_ADMIN: 'Remove this user’s admin role before banning them.',
  NOTE_TOO_LONG: 'Keep the note under 500 characters.',
};

export default function UserActions({ userId, isAdmin, isBanned }: { userId: string; isAdmin: boolean; isBanned: boolean }) {
  const router = useRouter();
  const [duration, setDuration] = useState('24H');
  const [reason, setReason] = useState('OTHER');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: string, confirmText: string, body?: object) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/users/${userId}/${path}`, { method: 'POST', body: JSON.stringify(body ?? {}) });
      router.refresh();
    } catch (err) {
      setError((err instanceof ApiError && err.code && ERRORS[err.code]) || 'That didn’t go through. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
      {!isBanned && !isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="text-xs font-semibold text-gray-700">
            Ban length
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm">
              {BAN_DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm">
              {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Note (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm" />
          </label>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {isBanned ? (
          <button type="button" disabled={busy} onClick={() => run('unban', 'Lift this ban now?', { note })} className="rsu-btn-secondary disabled:opacity-60">Unban</button>
        ) : (
          !isAdmin && (
            <button type="button" disabled={busy} onClick={() => run('ban', 'Ban this user? They will be signed out of every page and emailed.', { duration, reason, note })} className="rsu-btn-primary disabled:opacity-60">Ban user</button>
          )
        )}
        {isAdmin ? (
          <button type="button" disabled={busy} onClick={() => run('demote', 'Remove admin access from this user?')} className="rsu-btn-secondary disabled:opacity-60">Remove admin</button>
        ) : (
          <button type="button" disabled={busy} onClick={() => run('promote', 'Give this user full admin access?')} className="rsu-btn-secondary disabled:opacity-60">Make admin</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Cancel button** `src/app/auth/admin/users/[id]/CancelTripButton.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function CancelTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    const reason = window.prompt('Why are you cancelling this trip? The host and passengers will see this.');
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/trips/${tripId}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) });
      router.refresh();
    } catch {
      window.alert('Couldn’t cancel that trip. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={cancel} disabled={busy} className="shrink-0 text-xs font-semibold text-red-600 hover:underline disabled:opacity-60">
      Cancel trip
    </button>
  );
}
```

- [ ] **Step 5: Verify in the browser**

1. Search by part of a name, by email, and by university ID.
2. Open a user. Ban them for 24 hours and confirm the badge appears and the ban history updates; then unban.
3. Promote and then demote a second account.
4. Cancel one of their open trips and confirm the trip shows as cancelled.
5. Check the page at 375 px and at desktop width, in both themes.
6. Run `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add src/app/auth/admin/users
git commit -m "feat: add admin user search, detail and moderation actions"
```

---

### Task 10: Fuel-price page and the cap in the post-trip form

**Files:**
- Create: `src/app/auth/admin/fuel-price/page.tsx`, `src/app/auth/admin/fuel-price/FuelPriceForm.tsx`
- Modify: `src/app/auth/post/PostTripForm.tsx` (fuel price state at line ~125, `fuelPriceError` at lines ~212–215, the price input's hint at ~568, and the submit `catch` at ~395–407)

**Interfaces:**
- Consumes: `GET /api/fuel-price`, `PUT /api/admin/fuel-price`, `GET /api/admin/fuel-price/history` (Task 3).

- [ ] **Step 1: Admin page** `src/app/auth/admin/fuel-price/page.tsx`

```tsx
import Card from '@/components/Card';
import { apiFetch } from '@/lib/api-server';
import { formatDateTime } from '@/lib/admin';
import FuelPriceForm from './FuelPriceForm';

interface HistoryRow { id: string; pricePerLiter: number; createdAt: string; setBy: { id: string; fullName: string } }

export default async function AdminFuelPricePage() {
  const [{ official, updatedAt }, { history }] = await Promise.all([
    apiFetch<{ official: number | null; updatedAt: string | null }>('/api/fuel-price'),
    apiFetch<{ history: HistoryRow[] }>('/api/admin/fuel-price/history'),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Official price</p>
        <p className="text-3xl font-extrabold text-gray-900 tabular-nums mt-1">{official != null ? `₱${official.toFixed(2)}/L` : 'Not set'}</p>
        <p className="text-xs text-gray-500 mt-1">
          {updatedAt ? `Updated ${formatDateTime(updatedAt)}. ` : ''}
          Hosts can enter this price or less when posting a trip, never more. Trips already posted keep their price.
        </p>
        <FuelPriceForm current={official} />
      </Card>
      <Card>
        <h2 className="text-sm font-bold text-gray-900 mb-2">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">No official price has been set yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {history.map((h) => (
              <li key={h.id} className="py-2 flex justify-between gap-3 text-sm">
                <span className="tabular-nums font-semibold text-gray-900">₱{h.pricePerLiter.toFixed(2)}</span>
                <span className="text-xs text-gray-500 text-right">{h.setBy.fullName} · {formatDateTime(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Form** `src/app/auth/admin/fuel-price/FuelPriceForm.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { MIN_FUEL_PRICE_PER_LITER, MAX_FUEL_PRICE_PER_LITER } from '@/lib/constants';

export default function FuelPriceForm({ current }: { current: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current != null ? String(current) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(value);
    if (!Number.isFinite(price) || price < MIN_FUEL_PRICE_PER_LITER || price > MAX_FUEL_PRICE_PER_LITER) {
      setError(`Enter a price between ₱${MIN_FUEL_PRICE_PER_LITER} and ₱${MAX_FUEL_PRICE_PER_LITER}.`);
      return;
    }
    if (!window.confirm(`Set the official price to ₱${price.toFixed(2)}/L for everyone?`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/admin/fuel-price', { method: 'PUT', body: JSON.stringify({ pricePerLiter: price }) });
      setSaved(true);
      router.refresh();
    } catch {
      setError('Couldn’t save the price. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col md:flex-row gap-2 md:items-end">
      <label htmlFor="official-fuel-price" className="flex-1 text-xs font-semibold text-gray-700 uppercase tracking-wider">
        New price (₱/liter)
        <input
          id="official-fuel-price"
          type="number"
          step="0.01"
          min={MIN_FUEL_PRICE_PER_LITER}
          max={MAX_FUEL_PRICE_PER_LITER}
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false); }}
          className="rsu-input-no-spinner mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm normal-case"
        />
      </label>
      <button type="submit" disabled={busy} className="rsu-btn-primary disabled:opacity-60">{busy ? 'Saving…' : 'Set official price'}</button>
      {error && <p className="text-xs text-red-600 md:self-center">{error}</p>}
      {saved && !error && <p className="text-xs text-green-700 md:self-center">Saved.</p>}
    </form>
  );
}
```

- [ ] **Step 3: Enforce the cap in the post-trip form**

In `src/app/auth/post/PostTripForm.tsx`:

(a) After the `fuelPricePerLiter` state, load the official price once for new trips:

```tsx
  const [officialFuelPrice, setOfficialFuelPrice] = useState<number | null>(null);
  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    apiFetch<{ official: number | null }>('/api/fuel-price')
      .then(({ official }) => {
        if (cancelled || official == null) return;
        setOfficialFuelPrice(official);
        setFuelPricePerLiter(String(official));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isEdit]);
```

If `isEdit` is declared further down the component, move this block below that declaration. Make sure `useEffect` is in the React import.

(b) Extend `fuelPriceError` so the cap is checked after the bounds:

```tsx
  const fuelPriceError =
    !isEdit && fuelPriceIsValidNumber && (fuelPriceValue < MIN_FUEL_PRICE_PER_LITER || fuelPriceValue > MAX_FUEL_PRICE_PER_LITER)
      ? `Enter a price between ₱${MIN_FUEL_PRICE_PER_LITER} and ₱${MAX_FUEL_PRICE_PER_LITER} per liter.`
      : !isEdit && fuelPriceIsValidNumber && officialFuelPrice != null && fuelPriceValue > officialFuelPrice
        ? `The official price is ₱${officialFuelPrice.toFixed(2)}/L. You can enter less, not more.`
        : null;
```

(c) Replace the hint paragraph under the price input with:

```tsx
              <p className="text-[11px] text-gray-400 mt-1">
                {officialFuelPrice != null
                  ? `Official price ₱${officialFuelPrice.toFixed(2)}/L. You can enter less, not more.`
                  : 'Today’s pump price — used to compute the fuel share above. No live price feed, so enter it yourself.'}
              </p>
```

(d) In the submit `catch`, before the final `else`, add:

```tsx
      } else if (err instanceof ApiError && err.code === 'FUEL_PRICE_ABOVE_OFFICIAL') {
        const cap = Number(err.body?.officialPrice);
        setOfficialFuelPrice(cap);
        setError(`The official price is now ₱${cap.toFixed(2)}/L. Lower your price and post again.`);
```

- [ ] **Step 4: Verify in the browser**

1. As an admin, set the price to 60 and confirm it appears in the history.
2. As a host, open `/auth/post`:
   - the field pre-fills 60 and the hint shows the official price
   - typing 61 shows the inline cap error
   - 55 posts successfully
3. With no official price set (fresh database), the old hint and the 20–150 rule still apply.
4. Check the pages at 375 px and at desktop width, in both themes.
5. Run `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/admin/fuel-price src/app/auth/post/PostTripForm.tsx
git commit -m "feat: add official fuel price admin page and cap it in the post form"
```

---

### Task 11: Postman admin folder, docs and final verification

**Files:**
- Modify:
  - `postman/local.postman_environment.json` (add `adminEmail`, `adminPassword`)
  - `server/scripts/seedPostman.js` (create the admin account with `isAdmin: true`)
  - `postman/RideShareEU.postman_collection.json` (regenerate from the scratchpad builder with the additions below)
  - `AGENTS.md`, `docs/security/owasp-top10-review.md`, `docs/thesis/thesis-proposal.md`

- [ ] **Step 1: Seed an admin**

- Add `adminEmail = postman-admin@test.local` and `adminPassword = Postman-Admin-2026` (type secret) to the environment.
- In `seedPostman.js`:
  - include `env.adminEmail` in `removeExisting`
  - after creating the passenger, create the admin with `createUser({ email: env.adminEmail, password: env.adminPassword, fullName: 'Postman Admin', universityId: 'POSTMAN-ADMIN' })`
  - then run `prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } })`.

- [ ] **Step 2: Collection additions**

- **1. Auth:** add "Log in as admin", which saves `adminToken`/`adminId`.
- **3. Trips:** before "Post a trip", add "Read official fuel price" (`GET /api/fuel-price`). Its test:
  - sets `tripFuelPrice = official == null ? 60 : Math.min(60, official)`
  - sets `expectedShare = Number(((12.5 / 12) * tripFuelPrice / 3).toFixed(2))`

  Both trip bodies use `"fuelPricePerLiter": {{tripFuelPrice}}`. The trip and join assertions compare against `Number(pm.collectionVariables.get('expectedShare'))` instead of `20.83`.
- **New folder "13. Admin"**, run after Reports:
  1. Overview as the admin → 200, `counts.openReports >= 1`.
  2. Overview as the host → 403 `ADMIN_ONLY`.
  3. List open reports → find the report whose `reportedUser.id === hostId`; save `reportId`.
  4. Dismiss it (`PATCH` with `{status:'DISMISSED', note:'Postman review'}`) → 200.
  5. Search `q=postman-passenger` → the first user's id equals `passengerId`.
  6. Passenger detail → 200, `user.isAdmin === false`.
  7. Ban the passenger 24H with reason `OTHER` → 200.
  8. Passenger `GET /api/trips/mine` → 403 `ACCOUNT_SUSPENDED`.
  9. Unban the passenger → 200.
  10. Passenger `GET /api/trips/mine` → 200.
  11. Ban self → 400 `CANNOT_TARGET_SELF`.
  12. Promote the host → 200, then demote the host → 200.
  13. Host posts a trip (reuse the trip body), then the admin cancels it with `{reason:'Postman admin cancel'}` → 200 `TRIP_CANCELLED`.
  14. Set the fuel price to `{{tripFuelPrice}}` (unchanged effective cap) → 200.
  15. History → first row `setBy.id === adminId`.
  16. Audit log → contains `BAN`, `UNBAN`, `PROMOTE`, `DEMOTE`, `TRIP_CANCELLED`, `REPORT_DISMISSED`.

  The admin email is `@test.local`, and the ban email for the passenger goes to `@test.local` too. It never delivers, same as the existing report flow.

- [ ] **Step 3: Docs**

- **`AGENTS.md`:** add an "Admin role (Oct 2026)" section covering:
  - `npm run make-admin <email>`
  - `/api/admin/*` guarded by `requireAdmin`, and `GET /api/fuel-price`
  - the official price is a cap
  - every admin write is audited in `AdminAction`
  - admins can't read chats
- **`docs/security/owasp-top10-review.md`:**
  - A01: add `requireAdmin` plus the DB-read `isAdmin` as evidence.
  - A09: mark admin actions and automatic bans as audited; failed-login logging is still open.
- **`docs/thesis/thesis-proposal.md`:**
  - Fuel Share Calculation: "FuelPricePerLiter is entered by the Ride Host for each trip, up to the official price set by an administrator; the system rejects a higher value, and values outside PHP 20 to 150."
  - Report/moderation passages: "Reports trigger an automatic strike ladder; administrators also review reports, can ban or lift bans, and every administrative action is recorded in an audit log."
  - Remove any statement that the system has no admin role.

- [ ] **Step 4: Final verification**

Run:
- `npm test`: all suites pass.
- `npx tsc --noEmit`: clean.
- `npm run build`: compiles.
- Restart the API, then `npm run seed:postman && npm run test:api`: every request passes.

Then:
- Walk each admin page once more in the browser.
- Check authorship with `git log origin/main..HEAD --format='%an <%ae>%n%b' | grep -ci "claude\|anthropic"` → `0`.

- [ ] **Step 5: Commit**

```bash
git add postman server/scripts/seedPostman.js AGENTS.md docs/security/owasp-top10-review.md docs/thesis/thesis-proposal.md
git commit -m "test: cover admin endpoints in Postman; document the admin role"
```

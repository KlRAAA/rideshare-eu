# Superadmin and Data Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one superadmin (the school's DPO) who alone manages admins and releases a person's trip records for an investigation, with every release recorded.

**Architecture:** A new `User.isSuperAdmin` flag is read by `authenticate` alongside `isAdmin`. A `requireSuperAdmin` middleware guards promote/demote and a new `/api/admin/data-requests` router. A `DataRequest` row records each request; the release itself is built on demand by `dataRequestService.buildRelease` and never stored. Every release, reopening and paperwork confirmation is an `AdminAction` written in the same transaction, and regular admins see those entries without the subject.

**Tech Stack:** Express 5, Prisma 7 + PostgreSQL 17, Jest 30 (server against the real DB; web via `jest.web.config.mjs`), Next.js 16 App Router, Postman/newman.

**Spec:** `docs/superpowers/specs/2026-10-05-superadmin-data-requests-design.md` (D1–D12, scenarios A1–A5, S1–S10, H1–H4).

## Global Constraints

- Exactly one superadmin, set only by `npm run make-superadmin <email> [--replace]`.
- Error codes (exact): `SUPERADMIN_ONLY` (403), `TARGET_IS_SUPERADMIN` (409), `LAST_SUPERADMIN` (409), `INVALID_DATA_REQUEST` (400, with `field`), `CANNOT_TARGET_SELF` (400), `USER_NOT_FOUND` (404), `SUPERADMIN_EXISTS` (script), `PASSWORD_REQUIRED` (400), `INVALID_PASSWORD` (403).
- Deviation from spec §6: a wrong password returns **403** `INVALID_PASSWORD` (not 401), matching `DELETE /api/users/me`, so the frontend's 401 handler doesn't treat it as a lost session.
- `DataRequestBasis`: `WARRANT`, `COURT_ORDER`, `SUBPOENA`, `EMERGENCY`. Chats/support only with `WARRANT` or `COURT_ORDER`.
- Range: `fromDate`/`toDate` are `YYYY-MM-DD` Philippine dates, at most 366 days apart; ignored for `EMERGENCY`.
- Emergency paperwork due 72 hours after the release.
- A release never contains: passwords, codes, emails, security logs, IPs, ratings, co-riders' other trips or their university IDs.
- Copy (exact): button "Release records"; note above it "This is recorded permanently in the audit log."; release footer "Confidential: released under RA 10173"; admin user page note "Trip history is released only through a data request."
- Commits: author `Xyrus <xyrusdimacali@gmail.com>`, short imperative subject, no AI trailers. No push.

---

## File map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `isSuperAdmin`, `DataRequestBasis`, `DataRequest`, 4 action types |
| `server/middleware/authenticate.js` | `req.user.isSuperAdmin` |
| `server/middleware/requireSuperAdmin.js` (new) | 403 `SUPERADMIN_ONLY` |
| `server/scripts/makeSuperAdmin.js` (new) | CLI + `makeSuperAdmin(email, { replace })` |
| `server/services/adminModerationService.js` | `TARGET_IS_SUPERADMIN` on ban/demote |
| `server/services/adminActionService.js` | `redactDataActions(actions, isSuperAdmin)` |
| `server/services/accountDeletionService.js` | `LAST_SUPERADMIN` |
| `server/services/dataRequestValidation.js` (new) | Pure `validateDataRequest(body)` |
| `server/services/dataRequestService.js` (new) | `buildRelease(db, request, now)`, `paperworkDueAt`, `isOverdue` |
| `server/controllers/admin/dataRequestController.js` (new) | list, create, open, paperwork |
| `server/routes/adminRoutes.js` | wire routes and guards |
| `server/controllers/admin/userController.js` | trimmed detail, `isSuperAdmin`, search flag |
| `server/controllers/admin/overviewController.js` | redaction, `overdueDataPaperwork` |
| `server/controllers/userController.js` | own `isSuperAdmin` |
| `server/test-helpers/seed.js` | `makeSuperAdminUser`, cleanup of `DataRequest` |
| `src/lib/dataRequests.ts` (new) | labels, form check, paperwork status |
| `src/lib/admin.ts`, `src/lib/session.ts` | new action labels, `isSuperAdmin` |
| `src/app/auth/admin/data-requests/**` (new) | list, new-request form, release page |
| `src/components/ReleaseView.tsx` (new) | printable release |
| `src/app/auth/admin/AdminNav.tsx`, `layout.tsx`, `page.tsx`, `users/[id]/*` | nav item, overview card, trimmed user page |
| seeds, Postman, docs | as named in Tasks 6–7 |

---

### Task 1: Superadmin flag, script and guards on the role itself

**Files:**
- Modify: `prisma/schema.prisma`, `server/middleware/authenticate.js:59,93`, `server/controllers/userController.js` (getById), `server/services/accountDeletionService.js:33-36`, `server/test-helpers/seed.js`, `package.json`
- Create: `server/middleware/requireSuperAdmin.js`, `server/scripts/makeSuperAdmin.js`, `server/__tests__/superadminRole.test.js`

**Interfaces:**
- Produces: `req.user = { id, isAdmin, isSuperAdmin }`; `requireSuperAdmin(req,res,next)`; `makeSuperAdmin(email: string, { replace?: boolean }) → Promise<{ already: boolean, replacedId: string|null }>` throwing `Error('USER_NOT_FOUND' | 'SUPERADMIN_EXISTS')`; seed `makeSuperAdminUser(bag, opts)`.

- [ ] **Step 1: Schema.** In `model User` after `isAdmin`:

```prisma
  // The one superadmin (the school's Data Protection Officer): manages admins
  // and alone releases records for a data request. Set only by
  // `npm run make-superadmin`; read by authenticate on every request.
  isSuperAdmin Boolean @default(false)
```

Add to `enum AdminActionType`: `DATA_RELEASED`, `DATA_RELEASE_VIEWED`, `DATA_PAPERWORK_RECEIVED`, `SUPERADMIN_SET`. Add:

```prisma
enum DataRequestBasis {
  WARRANT
  COURT_ORDER
  SUBPOENA
  EMERGENCY
}

// A request from the police or another authority for one person's records.
// Holds who asked and why, never the released data (that is rebuilt when
// opened, so no second copy of personal data is kept). Ids are plain, like
// AdminAction's targets, so the record survives account deletion.
model DataRequest {
  id                  String           @id @default(cuid())
  createdById         String
  subjectUserId       String
  agency              String
  officerName         String
  officerContact      String
  referenceNumber     String
  legalBasis          DataRequestBasis
  fromDate            DateTime?
  toDate              DateTime?
  includeChats        Boolean          @default(false)
  includeSupport      Boolean          @default(false)
  verificationNote    String
  paperworkDueAt      DateTime?
  paperworkReceivedAt DateTime?
  createdAt           DateTime         @default(now())

  @@index([createdAt])
}
```

Run `node scripts/backup-db.mjs`, `npx prisma db push`, `npx prisma generate` (additive; no data loss expected).

- [ ] **Step 2: Failing test** `server/__tests__/superadminRole.test.js` (H1–H3, own flag, middleware). Use `newBag/makeUser/makeAdminUser/cleanup` and the `dbUp` guard like `tripsAuth.test.js`.

```js
require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { makeSuperAdmin } = require('../scripts/makeSuperAdmin');
const { newBag, makeUser, makeAdminUser, cleanup } = require('../test-helpers/seed');

let server, base, dbUp = false;
const bag = newBag();
let previous; // the dev DB's real superadmin, restored afterwards

const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeAll(async () => {
  try { await prisma.$queryRawUnsafe('SELECT 1'); dbUp = true; } catch { /* stays false */ }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  if (dbUp) previous = await prisma.user.findFirst({ where: { isSuperAdmin: true }, select: { id: true } });
});

afterAll(async () => {
  if (dbUp) {
    await prisma.user.updateMany({ where: { id: { in: bag.userIds } }, data: { isSuperAdmin: false } });
    if (previous) await prisma.user.update({ where: { id: previous.id }, data: { isSuperAdmin: true } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;

describe('make-superadmin', () => {
  test('H1/H2: sets one superadmin, refuses a second, hands over with --replace', async () => {
    if (guard()) return;
    if (previous) await prisma.user.update({ where: { id: previous.id }, data: { isSuperAdmin: false } });
    const first = await makeUser(bag);
    const second = await makeUser(bag);

    expect(await makeSuperAdmin(first.email)).toEqual({ already: false, replacedId: null });
    const row = await prisma.user.findUnique({ where: { id: first.id } });
    expect(row).toMatchObject({ isAdmin: true, isSuperAdmin: true });
    expect(await prisma.adminAction.count({ where: { action: 'SUPERADMIN_SET', targetUserId: first.id } })).toBe(1);

    await expect(makeSuperAdmin(second.email)).rejects.toThrow('SUPERADMIN_EXISTS');
    expect(await makeSuperAdmin(second.email, { replace: true })).toEqual({ already: false, replacedId: first.id });
    expect(await prisma.user.findUnique({ where: { id: first.id } })).toMatchObject({ isAdmin: true, isSuperAdmin: false });
    expect(await prisma.user.count({ where: { isSuperAdmin: true } })).toBe(1);
    expect(await makeSuperAdmin(second.email)).toEqual({ already: true, replacedId: null });
    await expect(makeSuperAdmin('nobody@test.local')).rejects.toThrow('USER_NOT_FOUND');
  });
});

describe('the role', () => {
  test('your own profile says whether you are the superadmin; others never see it', async () => {
    if (guard()) return;
    const sa = await makeAdminUser(bag);
    await prisma.user.update({ where: { id: sa.id }, data: { isSuperAdmin: true } });
    const other = await makeUser(bag);
    expect((await (await call('GET', `/api/users/${sa.id}`, sa.id)).json()).user.isSuperAdmin).toBe(true);
    expect((await (await call('GET', `/api/users/${sa.id}`, other.id)).json()).user).not.toHaveProperty('isSuperAdmin');
    await prisma.user.update({ where: { id: sa.id }, data: { isSuperAdmin: false } });
  });

  test('H3: the superadmin cannot delete their account', async () => {
    if (guard()) return;
    const bcrypt = require('bcrypt');
    const sa = await makeAdminUser(bag);
    await prisma.user.update({ where: { id: sa.id }, data: { isSuperAdmin: true, passwordHash: await bcrypt.hash('Right-Pass-1', 4) } });
    const res = await call('DELETE', '/api/users/me', sa.id, { password: 'Right-Pass-1' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('LAST_SUPERADMIN');
    await prisma.user.update({ where: { id: sa.id }, data: { isSuperAdmin: false } });
  });
});
```

(Restore the dev DB's real superadmin in `afterAll`, as shown, so running tests never changes who the DPO is.)

- [ ] **Step 3: Run** `npx jest server/__tests__/superadminRole.test.js --forceExit` → FAIL.

- [ ] **Step 4: Implement.**

`authenticate.js`: select `isSuperAdmin: true`; `req.user = { id: userId, isAdmin: user?.isAdmin === true, isSuperAdmin: user?.isSuperAdmin === true };`

`server/middleware/requireSuperAdmin.js`:

```js
// After authenticate (which re-reads the flag every request). Guards the
// powers only the superadmin has: managing admins and data requests.
function requireSuperAdmin(req, res, next) {
  if (!req.user?.isSuperAdmin) return res.status(403).json({ error: 'SUPERADMIN_ONLY' });
  return next();
}

module.exports = { requireSuperAdmin };
```

`server/scripts/makeSuperAdmin.js`:

```js
// Sets the one superadmin (the school's Data Protection Officer):
//   npm run make-superadmin <email>            first time
//   npm run make-superadmin <email> --replace  handover to someone new
// Never available in the app, so a hacked admin account can't grant it.
require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { record } = require('../services/adminActionService');

async function makeSuperAdmin(email, { replace = false } = {}) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
  if (!user || user.deletedAt) throw new Error('USER_NOT_FOUND');
  const current = await prisma.user.findFirst({ where: { isSuperAdmin: true }, select: { id: true } });
  if (current?.id === user.id) return { already: true, replacedId: null };
  if (current && !replace) throw new Error('SUPERADMIN_EXISTS');

  await prisma.$transaction(async (tx) => {
    if (current) await tx.user.update({ where: { id: current.id }, data: { isSuperAdmin: false } });
    await tx.user.update({ where: { id: user.id }, data: { isAdmin: true, isSuperAdmin: true } });
    await record(tx, {
      action: 'SUPERADMIN_SET',
      targetUserId: user.id,
      details: { via: 'make-superadmin script', replacedId: current?.id ?? null },
    });
  });
  return { already: false, replacedId: current?.id ?? null };
}

const MESSAGES = {
  USER_NOT_FOUND: (email) => `No account with email ${email}.`,
  SUPERADMIN_EXISTS: () => 'There is already a superadmin. Use --replace to hand over.',
};

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run make-superadmin <email> [--replace]');
    process.exitCode = 1;
    return;
  }
  try {
    const { already } = await makeSuperAdmin(email, { replace: process.argv.includes('--replace') });
    console.warn(already ? `${email} is already the superadmin.` : `${email} is now the superadmin.`);
  } catch (err) {
    console.error(MESSAGES[err.message] ? MESSAGES[err.message](email) : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();

module.exports = { makeSuperAdmin };
```

`package.json` scripts: `"make-superadmin": "node server/scripts/makeSuperAdmin.js",`.

`userController.getById`: select `isSuperAdmin: true`; destructure `const { email, isAdmin, isSuperAdmin, gender, ...rest } = user;` (own profile keeps all).

`accountDeletionService.js`, select `isSuperAdmin` and before the admin check:

```js
    // Handed over with `npm run make-superadmin <email> --replace` first.
    if (user.isSuperAdmin) throw new AccountDeletionError(409, 'LAST_SUPERADMIN');
```

`seed.js`: add

```js
async function makeSuperAdminUser(bag, opts) {
  const user = await makeAdminUser(bag, opts);
  await prisma.user.update({ where: { id: user.id }, data: { isSuperAdmin: true } });
  return { ...user, isSuperAdmin: true };
}
```

export it, and in `cleanup` before deleting users:

```js
  await prisma.dataRequest.deleteMany({
    where: { OR: [{ createdById: { in: bag.userIds } }, { subjectUserId: { in: bag.userIds } }] },
  });
```

`src/lib/session.ts`: `isSuperAdmin?: boolean;` on `CurrentUser`.

- [ ] **Step 5: Run** the test → PASS. Then `npx jest server/__tests__/accountDeletion* server/__tests__/authMiddleware* --forceExit` → PASS.
- [ ] **Step 6: Commit** `feat: add the superadmin role and make-superadmin script`

---

### Task 2: Admin powers trimmed to least privilege

**Files:**
- Modify: `server/routes/adminRoutes.js`, `server/services/adminModerationService.js` (`loadTarget`, `banUser`, `setAdmin`), `server/services/adminActionService.js`, `server/controllers/admin/userController.js` (search, detail), `server/controllers/admin/overviewController.js` (overview, listActions)
- Test: create `server/__tests__/adminLeastPrivilege.test.js`; update existing admin tests that promote/demote or read `joinedMatches`

**Interfaces:**
- Produces: `redactDataActions(actions: Array, isSuperAdmin: boolean) → Array`; `DATA_ACTIONS` set; admin detail `user.isSuperAdmin`, `hostedTrips` (OPEN/FULL only), no `joinedMatches`.

- [ ] **Step 1: Failing test** (A1, A2, A3, A5):

```js
// setup as in Task 1 (call(), dbUp guard, bag); seed: sa = makeSuperAdminUser, admin = makeAdminUser, user = makeUser
test('A1: an admin cannot promote or demote; the superadmin can', async () => {
  const target = await makeUser(bag);
  const r1 = await call('POST', `/api/admin/users/${target.id}/promote`, admin.id);
  expect(r1.status).toBe(403);
  expect((await r1.json()).error).toBe('SUPERADMIN_ONLY');
  expect((await call('POST', `/api/admin/users/${target.id}/promote`, sa.id)).status).toBe(200);
  expect((await call('POST', `/api/admin/users/${target.id}/demote`, admin.id)).status).toBe(403);
  expect((await call('POST', `/api/admin/users/${target.id}/demote`, sa.id)).status).toBe(200);
});

test('A2: nobody can ban the superadmin', async () => {
  const res = await call('POST', `/api/admin/users/${sa.id}/ban`, admin.id, { duration: '24H', reason: 'SPAM' });
  expect(res.status).toBe(409);
  expect((await res.json()).error).toBe('TARGET_IS_SUPERADMIN');
});

test('A3: the admin user page shows open hosted trips only', async () => {
  const vehicle = await makeVehicle(bag, user.id);
  const open = await makeTrip(bag, user.id, vehicle.id, { status: 'OPEN' });
  const done = await makeTrip(bag, user.id, vehicle.id, { status: 'COMPLETED' });
  const body = await (await call('GET', `/api/admin/users/${user.id}`, admin.id)).json();
  const ids = body.hostedTrips.map((t) => t.id);
  expect(ids).toContain(open.id);
  expect(ids).not.toContain(done.id);
  expect(body).not.toHaveProperty('joinedMatches');
  expect(body.user.isSuperAdmin).toBe(false);
});

test('A5: admins see that a release happened but not who it was about', async () => {
  await prisma.adminAction.create({
    data: { actorId: sa.id, action: 'DATA_RELEASED', targetUserId: user.id,
      details: { dataRequestId: 'x', agency: 'PNP Lucena', referenceNumber: 'BLT-1', legalBasis: 'WARRANT' } },
  });
  const forAdmin = (await (await call('GET', '/api/admin/actions', admin.id)).json()).actions.find((a) => a.action === 'DATA_RELEASED' && a.actorId === sa.id);
  expect(forAdmin).toMatchObject({ targetUserId: null, targetUserName: null, details: { agency: 'PNP Lucena', referenceNumber: 'BLT-1', legalBasis: 'WARRANT' } });
  const forSa = (await (await call('GET', '/api/admin/actions', sa.id)).json()).actions.find((a) => a.action === 'DATA_RELEASED' && a.actorId === sa.id);
  expect(forSa.targetUserId).toBe(user.id);
  const overview = await (await call('GET', '/api/admin/overview', admin.id)).json();
  expect(JSON.stringify(overview.recentActions)).not.toContain(user.id);
});
```

(In `afterAll`, delete the test's `AdminAction` rows: `prisma.adminAction.deleteMany({ where: { actorId: { in: bag.userIds } } })` — already done by `cleanup`.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**

`adminRoutes.js`:

```js
const { requireSuperAdmin } = require('../middleware/requireSuperAdmin');
...
router.post('/users/:id/promote', requireSuperAdmin, users.promote);
router.post('/users/:id/demote', requireSuperAdmin, users.demote);
```

`adminModerationService.js`: `loadTarget` selects `isSuperAdmin: true`; in `banUser` before the admin check `if (target.isSuperAdmin) throw new AdminError(409, 'TARGET_IS_SUPERADMIN');`; in `setAdmin` after `loadTarget`: `if (!makeAdmin && target.isSuperAdmin) throw new AdminError(409, 'TARGET_IS_SUPERADMIN');`.

`adminActionService.js`:

```js
// Data-request entries name the person a release was about. Only the
// superadmin sees that; other admins see that a release happened (agency,
// reference, legal basis) and nothing else (spec D11).
const DATA_ACTIONS = new Set(['DATA_RELEASED', 'DATA_RELEASE_VIEWED', 'DATA_PAPERWORK_RECEIVED']);
const VISIBLE_DATA_DETAILS = ['agency', 'referenceNumber', 'legalBasis'];

function redactDataActions(actions, isSuperAdmin) {
  if (isSuperAdmin) return actions;
  return actions.map((a) => {
    if (!DATA_ACTIONS.has(a.action)) return a;
    const details = Object.fromEntries(VISIBLE_DATA_DETAILS.filter((k) => a.details?.[k] != null).map((k) => [k, a.details[k]]));
    return { ...a, targetUserId: null, targetUserName: null, details };
  });
}
```

export `redactDataActions, DATA_ACTIONS`. In `overviewController`: `recentActions: redactDataActions(await withNames(recent), req.user.isSuperAdmin)` and `actions: redactDataActions(await withNames(page), req.user.isSuperAdmin)`.

`admin/userController.getUserDetail`: select adds `isSuperAdmin: true`; hosted query becomes `prisma.trip.findMany({ where: { hostId: id, status: { in: ['OPEN', 'FULL'] } }, orderBy: { departureTime: 'asc' }, take: DETAIL_LIMIT, select: tripSelect })`; delete the `joinedMatches` query and its key from the response; add the comment: `// Past and joined trips are released only through a data request (superadmin spec D8).` `searchUsers` select adds `isSuperAdmin: true`.

- [ ] **Step 4:** Update existing tests: `grep -rln "promote\|demote\|joinedMatches" server/__tests__` — promote/demote calls switch the actor to a `makeSuperAdminUser`; assertions on `joinedMatches` are removed. Run `npx jest server/__tests__/admin* server/__tests__/adminLeastPrivilege.test.js --forceExit` → PASS.
- [ ] **Step 5: Commit** `feat: limit admins to moderation and hide trip history`

---

### Task 3: Data request validation and release builder

**Files:**
- Create: `server/services/dataRequestValidation.js`, `server/services/dataRequestService.js`, `server/services/__tests__/dataRequestValidation.test.js`, `server/__tests__/dataRequestRelease.test.js`

**Interfaces:**
- Produces: `validateDataRequest(body) → { field: string } | { value: CleanRequest }` where `CleanRequest = { subjectUserId, agency, officerName, officerContact, referenceNumber, legalBasis, fromDate: Date|null, toDate: Date|null, includeChats, includeSupport, verificationNote }`; `paperworkDueAt(basis, now) → Date|null`; `isOverdue(request, now) → boolean`; `buildRelease(db, request, now = new Date()) → Promise<Release>`.
- `Release = { generatedAt, request: { id, agency, officerName, referenceNumber, legalBasis, fromDate, toDate, includeChats, includeSupport }, subject: { name, universityId, role, deleted }, trips: ReleaseTrip[], supportRequests: Array | null }`; `ReleaseTrip = { departureTime, recurrenceType, customDays, origin, destination, meetingPoint, status, subjectRole: 'DRIVER'|'PASSENGER', subjectRequestStatus: string|null, driver, coRiders: string[], car: { make, model, color, plate }, messages: Array|null }`.

- [ ] **Step 1: Failing unit test** `dataRequestValidation.test.js`:

```js
const { validateDataRequest } = require('../dataRequestValidation');
const { paperworkDueAt, isOverdue } = require('../dataRequestService');

const ok = {
  subjectUserId: 'u1', agency: 'PNP Lucena City Police Station', officerName: 'PCPT Juan Cruz',
  officerContact: '0917 000 0000', referenceNumber: 'BLT-2026-0042', legalBasis: 'WARRANT',
  fromDate: '2026-09-01', toDate: '2026-09-30', verificationNote: 'Called the station on its listed number.',
};

test('a complete request is cleaned and dates become PH-day bounds', () => {
  const { value } = validateDataRequest({ ...ok, agency: '  PNP Lucena City Police Station ' });
  expect(value.agency).toBe('PNP Lucena City Police Station');
  expect(value.fromDate.toISOString()).toBe('2026-08-31T16:00:00.000Z');
  expect(value.toDate.toISOString()).toBe('2026-09-30T15:59:59.999Z');
  expect(value).toMatchObject({ includeChats: false, includeSupport: false });
});

test.each([
  ['agency', { agency: '' }],
  ['officerName', { officerName: ' ' }],
  ['officerContact', { officerContact: undefined }],
  ['referenceNumber', { referenceNumber: '' }],
  ['verificationNote', { verificationNote: '' }],
  ['legalBasis', { legalBasis: 'HUNCH' }],
  ['subjectUserId', { subjectUserId: '' }],
  ['fromDate', { fromDate: '2026-9-1' }],
  ['toDate', { toDate: '2026-08-01' }],          // S10 reversed
  ['toDate', { toDate: '2027-10-01' }],          // S10 longer than a year
  ['includeChats', { legalBasis: 'SUBPOENA', includeChats: true }],   // S2
  ['includeSupport', { legalBasis: 'EMERGENCY', includeSupport: true }],
])('rejects a bad %s', (field, over) => {
  expect(validateDataRequest({ ...ok, ...over })).toEqual({ field });
});

test('an emergency needs no dates', () => {
  const { value } = validateDataRequest({ ...ok, legalBasis: 'EMERGENCY', fromDate: undefined, toDate: undefined });
  expect(value).toMatchObject({ fromDate: null, toDate: null });
});

test('S5: emergency paperwork is due in 72 hours and then overdue', () => {
  const now = new Date('2026-10-05T00:00:00Z');
  const due = paperworkDueAt('EMERGENCY', now);
  expect(due.toISOString()).toBe('2026-10-08T00:00:00.000Z');
  expect(paperworkDueAt('WARRANT', now)).toBeNull();
  expect(isOverdue({ paperworkDueAt: due, paperworkReceivedAt: null }, new Date('2026-10-08T00:00:01Z'))).toBe(true);
  expect(isOverdue({ paperworkDueAt: due, paperworkReceivedAt: now }, new Date('2026-10-09T00:00:00Z'))).toBe(false);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `server/services/dataRequestValidation.js`:

```js
// Checks a data request before anything is released (superadmin spec §6).
// Returns { field } for the first problem, or { value } with cleaned values.
const BASES = ['WARRANT', 'COURT_ORDER', 'SUBPOENA', 'EMERGENCY'];
// Chat messages and support requests are released only when a warrant or
// court order names them (policy §5).
const CONTENT_BASES = ['WARRANT', 'COURT_ORDER'];
const TEXT_MAX = 200;
const NOTE_MAX = 1000;
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const text = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);

// Philippine calendar day (UTC+8, no DST) to its first and last instant.
function phDayStart(day) {
  return DATE_RE.test(day ?? '') ? new Date(`${day}T00:00:00.000+08:00`) : null;
}
function phDayEnd(day) {
  return DATE_RE.test(day ?? '') ? new Date(`${day}T23:59:59.999+08:00`) : null;
}

function validateDataRequest(body = {}) {
  const value = {};
  for (const f of ['subjectUserId', 'agency', 'officerName', 'officerContact', 'referenceNumber']) {
    value[f] = text(body[f], TEXT_MAX);
    if (!value[f]) return { field: f };
  }
  if (!BASES.includes(body.legalBasis)) return { field: 'legalBasis' };
  value.legalBasis = body.legalBasis;
  value.verificationNote = text(body.verificationNote, NOTE_MAX);
  if (!value.verificationNote) return { field: 'verificationNote' };

  if (value.legalBasis === 'EMERGENCY') {
    value.fromDate = null;
    value.toDate = null;
  } else {
    value.fromDate = phDayStart(body.fromDate);
    if (!value.fromDate || Number.isNaN(value.fromDate.getTime())) return { field: 'fromDate' };
    value.toDate = phDayEnd(body.toDate);
    if (!value.toDate || Number.isNaN(value.toDate.getTime())) return { field: 'toDate' };
    if (value.toDate < value.fromDate || value.toDate - value.fromDate > MAX_RANGE_MS) return { field: 'toDate' };
  }

  for (const flag of ['includeChats', 'includeSupport']) {
    value[flag] = body[flag] === true;
    if (value[flag] && !CONTENT_BASES.includes(value.legalBasis)) return { field: flag };
  }
  return { value };
}

module.exports = { validateDataRequest, BASES };
```

`server/services/dataRequestService.js` (helpers first; `buildRelease` is added in Step 6):

```js
const { decryptField, decryptTripFields } = require('./encryptionService');

const EMERGENCY_PAPERWORK_MS = 72 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function paperworkDueAt(basis, now = new Date()) {
  return basis === 'EMERGENCY' ? new Date(now.getTime() + EMERGENCY_PAPERWORK_MS) : null;
}

function isOverdue(request, now = new Date()) {
  return Boolean(request.paperworkDueAt && !request.paperworkReceivedAt && new Date(request.paperworkDueAt) < now);
}

module.exports = { paperworkDueAt, isOverdue };
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Failing integration test** `server/__tests__/dataRequestRelease.test.js` (S1, S4, S8, S9) calling `buildRelease(prisma, request, now)` directly with seeded rows:
  - Seed subject S (passenger), host H, co-rider C, outsider O.
  - Trip A (ONE_TIME, H hosts, 2026-09-10, status COMPLETED, vehicle plate `ABC 1234`): S and C COMPLETED matches, O DECLINED; one `Message` from S ("See you at the plaza").
  - Trip B (ONE_TIME, 2026-11-20): S APPROVED (outside a September range).
  - Trip C hosted by S (DAILY, first departure 2026-08-01, OPEN).
  - C also rode an unrelated trip D with H (must never appear).
  - S has a support ticket with one message.
  - Assertions, for request `{ legalBasis: 'WARRANT', fromDate: 2026-09-01 PH, toDate: 2026-09-30 PH, includeChats: true, includeSupport: true }`:
    - `release.trips` has Trip A and Trip C (recurring, started before the range, still running), not B, not D.
    - Trip A: `subjectRole: 'PASSENGER'`, `subjectRequestStatus: 'COMPLETED'`, `driver: 'Host Name'`, `coRiders: ['Co Rider']` (not O, not S), `car.plate: 'ABC 1234'`, `messages[0]` = `{ sender: <S name>, body: 'See you at the plaza', sentAt }`.
    - Trip C: `subjectRole: 'DRIVER'`, `subjectRequestStatus: null`.
    - `release.supportRequests` has the ticket and its message.
    - S9: `JSON.stringify(release)` contains no `@test.local` (emails) and not C's `universityId`.
  - Same request with `includeChats: false, includeSupport: false` → every `messages` is `null`, `supportRequests` is `null`.
  - S4 emergency with `now = 2026-09-10T12:00:00Z`: trips = Trip A (most recent one-time trip at or before now) and Trip C (active recurring) — not B; `messages` null even though `includeChats` is true on the row.
  - S8: after `deleteAccount(S.id)`... (use `prisma.user.update({ data: { deletedAt: new Date(), fullName: encryptField('Deleted user') } })`), `release.subject.deleted` is `true`.

- [ ] **Step 6: Implement `buildRelease`** (append to `dataRequestService.js` and export it):

```js
const name = (u) => (u ? decryptField(u.fullName) : null);
const TRIP_INCLUDE = {
  host: { select: { id: true, fullName: true } },
  vehicle: { select: { make: true, model: true, color: true, plate: true } },
  matches: { select: { passengerId: true, status: true, passenger: { select: { fullName: true } } } },
};
const RIDING = ['APPROVED', 'COMPLETED'];

function involving(subjectId) {
  return { OR: [{ hostId: subjectId }, { matches: { some: { passengerId: subjectId } } }] };
}

// Trips in the date range. A recurring trip that started earlier but still ran
// in the range counts too; its row shows the repeat pattern.
function tripsInRange(db, subjectId, from, to) {
  return db.trip.findMany({
    where: {
      AND: [
        involving(subjectId),
        { departureTime: { lte: to } },
        { OR: [{ departureTime: { gte: from } }, { recurrenceType: { not: 'ONE_TIME' }, status: { not: 'CANCELLED' } }] },
      ],
    },
    include: TRIP_INCLUDE,
    orderBy: { departureTime: 'asc' },
  });
}

// The minimum for a risk to life (policy §4): the most recent one-time trip
// at or before now, one-time trips in the next 24 hours, and the person's
// active recurring trips (their regular commute).
async function emergencyTrips(db, subjectId, now) {
  const [latest, upcoming, recurring] = await Promise.all([
    db.trip.findFirst({
      where: { AND: [involving(subjectId), { recurrenceType: 'ONE_TIME', departureTime: { lte: now } }] },
      include: TRIP_INCLUDE,
      orderBy: { departureTime: 'desc' },
    }),
    db.trip.findMany({
      where: { AND: [involving(subjectId), { recurrenceType: 'ONE_TIME', departureTime: { gt: now, lte: new Date(now.getTime() + DAY_MS) } }] },
      include: TRIP_INCLUDE,
    }),
    db.trip.findMany({
      where: { AND: [involving(subjectId), { recurrenceType: { not: 'ONE_TIME' }, status: { in: ['OPEN', 'FULL'] } }] },
      include: TRIP_INCLUDE,
    }),
  ]);
  return [latest, ...upcoming, ...recurring].filter(Boolean).sort((a, b) => a.departureTime - b.departureTime);
}

async function chatFor(db, tripId) {
  const rows = await db.message.findMany({
    where: { tripId },
    orderBy: { createdAt: 'asc' },
    select: { body: true, createdAt: true, sender: { select: { fullName: true } } },
  });
  return rows.map((m) => ({ sender: name(m.sender), body: m.body, sentAt: m.createdAt }));
}

async function toReleaseTrip(db, tripRaw, subjectId, withChats) {
  const trip = decryptTripFields(tripRaw);
  const own = trip.matches.find((m) => m.passengerId === subjectId);
  return {
    departureTime: trip.departureTime,
    recurrenceType: trip.recurrenceType,
    customDays: trip.customDays,
    origin: trip.originAddress,
    destination: trip.destinationAddress,
    meetingPoint: trip.meetingPointAddress ?? null,
    status: trip.status,
    subjectRole: trip.hostId === subjectId ? 'DRIVER' : 'PASSENGER',
    subjectRequestStatus: own ? own.status : null,
    driver: name(trip.host),
    coRiders: trip.matches
      .filter((m) => m.passengerId !== subjectId && RIDING.includes(m.status))
      .map((m) => name(m.passenger)),
    car: trip.vehicle,
    messages: withChats ? await chatFor(db, trip.id) : null,
  };
}

async function supportFor(db, subjectId) {
  const tickets = await db.supportTicket.findMany({
    where: { userId: subjectId },
    orderBy: { createdAt: 'asc' },
    include: { messages: { orderBy: { createdAt: 'asc' }, select: { fromAdmin: true, body: true, createdAt: true } } },
  });
  return tickets.map((t) => ({
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.createdAt,
    messages: t.messages.map((m) => ({ from: m.fromAdmin ? 'Admin' : 'User', body: m.body, sentAt: m.createdAt })),
  }));
}

// Built when opened, never stored (spec D10). Contains only what the request
// covers: no emails, passwords, codes, security logs, ratings, or co-riders'
// other trips (spec §5).
async function buildRelease(db, request, now = new Date()) {
  const subjectRow = await db.user.findUnique({
    where: { id: request.subjectUserId },
    select: { fullName: true, universityId: true, role: true, deletedAt: true },
  });
  const emergency = request.legalBasis === 'EMERGENCY';
  const rows = emergency
    ? await emergencyTrips(db, request.subjectUserId, now)
    : await tripsInRange(db, request.subjectUserId, request.fromDate, request.toDate);
  const withChats = request.includeChats && !emergency;
  const trips = [];
  for (const row of rows) trips.push(await toReleaseTrip(db, row, request.subjectUserId, withChats));

  return {
    generatedAt: now,
    request: {
      id: request.id,
      agency: request.agency,
      officerName: request.officerName,
      referenceNumber: request.referenceNumber,
      legalBasis: request.legalBasis,
      fromDate: request.fromDate,
      toDate: request.toDate,
      includeChats: withChats,
      includeSupport: request.includeSupport && !emergency,
    },
    subject: {
      name: subjectRow ? name(subjectRow) : null,
      universityId: subjectRow?.universityId ?? null,
      role: subjectRow?.role ?? null,
      deleted: Boolean(subjectRow?.deletedAt),
    },
    trips,
    supportRequests: request.includeSupport && !emergency ? await supportFor(db, request.subjectUserId) : null,
  };
}
```

(Check the deleted-account path: `accountDeletionService` replaces `universityId` too; whatever it holds is shown, and `subject.deleted` tells the reader why.)

- [ ] **Step 7: Run** both tests → PASS.
- [ ] **Step 8: Commit** `feat: build data request releases`

---

### Task 4: Data request API

**Files:**
- Create: `server/controllers/admin/dataRequestController.js`, `server/__tests__/dataRequests.test.js`
- Modify: `server/routes/adminRoutes.js`, `server/controllers/admin/overviewController.js`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `GET/POST /api/admin/data-requests`, `GET /api/admin/data-requests/:id`, `PATCH /api/admin/data-requests/:id/paperwork`; overview `overdueDataPaperwork: number | null` (null for non-superadmins).
- List item: `{ id, createdAt, agency, referenceNumber, legalBasis, subjectName, paperworkDueAt, paperworkReceivedAt, overdue }`.

- [ ] **Step 1: Failing test** (A4, S1, S3, S6, S7, paperwork, overdue): seed `sa` with a known bcrypt password (`bcrypt.hash('Right-Pass-1', 4)`), an `admin`, a `subject` with one completed trip.

```js
const body = (over = {}) => ({
  subjectUserId: subject.id, agency: 'PNP Lucena', officerName: 'PCPT Cruz', officerContact: '0917',
  referenceNumber: 'BLT-1', legalBasis: 'WARRANT', fromDate: '2026-09-01', toDate: '2026-09-30',
  verificationNote: 'Called the station.', password: 'Right-Pass-1', ...over,
});

test('A4: admins cannot use data requests', async () => {
  for (const [m, p] of [['GET', '/api/admin/data-requests'], ['POST', '/api/admin/data-requests']]) {
    const res = await call(m, p, admin.id, m === 'POST' ? body() : undefined);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('SUPERADMIN_ONLY');
  }
});

test('S3: a wrong or missing password releases nothing', async () => {
  expect((await call('POST', '/api/admin/data-requests', sa.id, body({ password: 'nope' }))).status).toBe(403);
  expect((await call('POST', '/api/admin/data-requests', sa.id, body({ password: '' }))).status).toBe(400);
  expect(await prisma.dataRequest.count({ where: { createdById: sa.id } })).toBe(0);
});

test('S7: the superadmin cannot request their own records', async () => {
  const res = await call('POST', '/api/admin/data-requests', sa.id, body({ subjectUserId: sa.id }));
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe('CANNOT_TARGET_SELF');
});

test('S1/S6: release is returned, recorded in the same step, and reopening is recorded', async () => {
  const res = await call('POST', '/api/admin/data-requests', sa.id, body());
  expect(res.status).toBe(201);
  const { request, release } = await res.json();
  expect(release.trips).toHaveLength(1);
  expect(await prisma.adminAction.count({ where: { action: 'DATA_RELEASED', targetUserId: subject.id } })).toBe(1);
  const reopened = await call('GET', `/api/admin/data-requests/${request.id}`, sa.id);
  expect(reopened.status).toBe(200);
  expect(await prisma.adminAction.count({ where: { action: 'DATA_RELEASE_VIEWED', targetUserId: subject.id } })).toBe(1);
});

test('S2 over HTTP: chats with a subpoena are refused', async () => {
  const res = await call('POST', '/api/admin/data-requests', sa.id, body({ legalBasis: 'SUBPOENA', includeChats: true }));
  expect(await res.json()).toEqual({ error: 'INVALID_DATA_REQUEST', field: 'includeChats' });
});

test('S4/S5: emergency paperwork is tracked, flagged when overdue, and can be marked received', async () => {
  const { request } = await (await call('POST', '/api/admin/data-requests', sa.id, body({ legalBasis: 'EMERGENCY', fromDate: undefined, toDate: undefined }))).json();
  expect(request.paperworkDueAt).toBeTruthy();
  await prisma.dataRequest.update({ where: { id: request.id }, data: { paperworkDueAt: new Date(Date.now() - 1000) } });
  const list = await (await call('GET', '/api/admin/data-requests', sa.id)).json();
  expect(list.requests.find((r) => r.id === request.id).overdue).toBe(true);
  expect((await (await call('GET', '/api/admin/overview', sa.id)).json()).overdueDataPaperwork).toBeGreaterThanOrEqual(1);
  expect((await (await call('GET', '/api/admin/overview', admin.id)).json()).overdueDataPaperwork).toBeNull();
  const done = await call('PATCH', `/api/admin/data-requests/${request.id}/paperwork`, sa.id);
  expect(done.status).toBe(200);
  expect((await prisma.dataRequest.findUnique({ where: { id: request.id } })).paperworkReceivedAt).not.toBeNull();
});

test('unknown subject → 404', async () => {
  const res = await call('POST', '/api/admin/data-requests', sa.id, body({ subjectUserId: 'does-not-exist' }));
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `dataRequestController.js`:

```js
const bcrypt = require('bcrypt');
const prisma = require('../../config/db');
const { record } = require('../../services/adminActionService');
const { decryptField } = require('../../services/encryptionService');
const { logSecurityEvent } = require('../../services/securityLog');
const { validateDataRequest } = require('../../services/dataRequestValidation');
const { buildRelease, paperworkDueAt, isOverdue } = require('../../services/dataRequestService');

const LIST_LIMIT = 100;
// What the activity log may show other admins (redacted further there).
const auditDetails = (r) => ({ dataRequestId: r.id, agency: r.agency, referenceNumber: r.referenceNumber, legalBasis: r.legalBasis });

async function passwordMatches(req, password) {
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { passwordHash: true } });
  if (me && (await bcrypt.compare(password, me.passwordHash))) return true;
  logSecurityEvent(req, 'PASSWORD_RECHECK_FAILED', { userId: req.user.id, reason: 'DATA_REQUEST' });
  return false;
}

async function list(req, res) {
  const rows = await prisma.dataRequest.findMany({ orderBy: { createdAt: 'desc' }, take: LIST_LIMIT });
  const subjects = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.subjectUserId))] } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(subjects.map((u) => [u.id, decryptField(u.fullName)]));
  const now = new Date();
  res.json({
    requests: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      agency: r.agency,
      referenceNumber: r.referenceNumber,
      legalBasis: r.legalBasis,
      subjectName: nameById.get(r.subjectUserId) ?? null,
      paperworkDueAt: r.paperworkDueAt,
      paperworkReceivedAt: r.paperworkReceivedAt,
      overdue: isOverdue(r, now),
    })),
  });
}

// Validate, re-check the password, then write the request and its audit entry
// in one transaction before building the release (spec D2, D9).
async function create(req, res) {
  const { password, ...fields } = req.body || {};
  const checked = validateDataRequest(fields);
  if (checked.field) return res.status(400).json({ error: 'INVALID_DATA_REQUEST', field: checked.field });
  const value = checked.value;
  if (value.subjectUserId === req.user.id) return res.status(400).json({ error: 'CANNOT_TARGET_SELF' });
  if (typeof password !== 'string' || password === '') return res.status(400).json({ error: 'PASSWORD_REQUIRED' });
  if (!(await passwordMatches(req, password))) return res.status(403).json({ error: 'INVALID_PASSWORD' });
  const subject = await prisma.user.findUnique({ where: { id: value.subjectUserId }, select: { id: true } });
  if (!subject) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  const now = new Date();
  const request = await prisma.$transaction(async (tx) => {
    const row = await tx.dataRequest.create({
      data: { ...value, createdById: req.user.id, paperworkDueAt: paperworkDueAt(value.legalBasis, now) },
    });
    await record(tx, { actorId: req.user.id, action: 'DATA_RELEASED', targetUserId: row.subjectUserId, details: auditDetails(row) });
    return row;
  });
  res.status(201).json({ request, release: await buildRelease(prisma, request, now) });
}

async function open(req, res) {
  const request = await prisma.dataRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'NOT_FOUND' });
  // Emergency releases are rebuilt as of the original release time.
  const asOf = request.legalBasis === 'EMERGENCY' ? request.createdAt : new Date();
  const release = await buildRelease(prisma, request, asOf);
  await record(prisma, { actorId: req.user.id, action: 'DATA_RELEASE_VIEWED', targetUserId: request.subjectUserId, details: auditDetails(request) });
  res.json({ request, release, overdue: isOverdue(request) });
}

async function markPaperwork(req, res) {
  const request = await prisma.dataRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'NOT_FOUND' });
  if (request.paperworkReceivedAt) return res.json({ request });
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.dataRequest.update({ where: { id: request.id }, data: { paperworkReceivedAt: new Date() } });
    await record(tx, { actorId: req.user.id, action: 'DATA_PAPERWORK_RECEIVED', targetUserId: row.subjectUserId, details: auditDetails(row) });
    return row;
  });
  res.json({ request: updated });
}

module.exports = { list, create, open, markPaperwork };
```

(Check `logSecurityEvent`'s allow-list in `securityLog.js` includes `reason`; `deleteMe` already passes it.)

`adminRoutes.js`:

```js
const dataRequests = require('../controllers/admin/dataRequestController');
const { authAttemptLimiter } = require('../middleware/rateLimit');
...
// Superadmin only (the school's DPO). Releasing re-checks the password and is
// rate-limited like sign-in.
router.get('/data-requests', requireSuperAdmin, dataRequests.list);
router.post('/data-requests', requireSuperAdmin, authAttemptLimiter(), dataRequests.create);
router.get('/data-requests/:id', requireSuperAdmin, dataRequests.open);
router.patch('/data-requests/:id/paperwork', requireSuperAdmin, dataRequests.markPaperwork);
```

`overviewController.overview`: add

```js
  const overdueDataPaperwork = req.user.isSuperAdmin
    ? await prisma.dataRequest.count({ where: { paperworkReceivedAt: null, paperworkDueAt: { lt: now } } })
    : null;
```

and include `overdueDataPaperwork` in the JSON.

- [ ] **Step 4: Run** the test → PASS; then `npx jest server --forceExit` → all green.
- [ ] **Step 5: Commit** `feat: let the superadmin release records for a data request`

---

### Task 5: Admin console UI

**Files:**
- Create: `src/lib/dataRequests.ts`, `src/lib/__tests__/dataRequests.test.ts`, `src/components/ReleaseView.tsx`, `src/app/auth/admin/data-requests/page.tsx`, `src/app/auth/admin/data-requests/new/page.tsx`, `src/app/auth/admin/data-requests/new/DataRequestForm.tsx`, `src/app/auth/admin/data-requests/[id]/page.tsx`, `src/app/auth/admin/data-requests/[id]/PaperworkButton.tsx`, `src/app/auth/admin/data-requests/PrintButton.tsx`
- Modify: `src/lib/admin.ts`, `src/lib/__tests__/admin.test.ts`, `src/app/auth/admin/AdminNav.tsx`, `src/app/auth/admin/layout.tsx`, `src/app/auth/admin/page.tsx` (overview card), `src/app/auth/admin/users/[id]/page.tsx`, `src/app/auth/admin/users/[id]/UserActions.tsx`, `src/app/auth/admin/users/page.tsx` (badge, if it lists roles)

**Interfaces:**
- Produces (`src/lib/dataRequests.ts`):

```ts
export type DataRequestBasis = 'WARRANT' | 'COURT_ORDER' | 'SUBPOENA' | 'EMERGENCY';
export const BASIS_OPTIONS: { value: DataRequestBasis; label: string }[];
export function basisLabel(b: string): string;
export function allowsContent(b: string): boolean;             // WARRANT, COURT_ORDER
export interface DataRequestFormValues { subjectUserId: string; agency: string; officerName: string; officerContact: string; referenceNumber: string; legalBasis: string; fromDate: string; toDate: string; includeChats: boolean; includeSupport: boolean; verificationNote: string; password: string; }
export function dataRequestFormError(v: DataRequestFormValues): string | null;
export function paperworkStatus(r: { paperworkDueAt: string | null; paperworkReceivedAt: string | null }, now?: number): 'overdue' | 'due' | 'received' | null;
export function tripRoleLabel(role: 'DRIVER' | 'PASSENGER'): string;
export const RELEASE_FOOTER = 'Confidential: released under RA 10173';
export const AUDIT_NOTE = 'This is recorded permanently in the audit log.';
```

- [ ] **Step 1: Failing web test** `src/lib/__tests__/dataRequests.test.ts`:

```ts
import { describe, test, expect } from '@jest/globals';
import { basisLabel, allowsContent, dataRequestFormError, paperworkStatus, RELEASE_FOOTER } from '../dataRequests';

const valid = {
  subjectUserId: 'u1', agency: 'PNP Lucena', officerName: 'PCPT Cruz', officerContact: '0917', referenceNumber: 'BLT-1',
  legalBasis: 'WARRANT', fromDate: '2026-09-01', toDate: '2026-09-30', includeChats: false, includeSupport: false,
  verificationNote: 'Called the station.', password: 'x',
};

describe('data requests', () => {
  test('labels', () => {
    expect(basisLabel('WARRANT')).toBe('Warrant to Disclose Computer Data');
    expect(basisLabel('EMERGENCY')).toBe('Emergency (risk to life)');
    expect(allowsContent('COURT_ORDER')).toBe(true);
    expect(allowsContent('SUBPOENA')).toBe(false);
    expect(RELEASE_FOOTER).toBe('Confidential: released under RA 10173');
  });

  test('form errors explain what is missing', () => {
    expect(dataRequestFormError(valid)).toBeNull();
    expect(dataRequestFormError({ ...valid, subjectUserId: '' })).toBe('Choose the person the request is about.');
    expect(dataRequestFormError({ ...valid, referenceNumber: ' ' })).toBe('Add the case, blotter or docket number.');
    expect(dataRequestFormError({ ...valid, toDate: '2026-08-01' })).toBe('The end date must be on or after the start date.');
    expect(dataRequestFormError({ ...valid, legalBasis: 'EMERGENCY', fromDate: '', toDate: '' })).toBeNull();
    expect(dataRequestFormError({ ...valid, legalBasis: 'SUBPOENA', includeChats: true })).toBe(
      'Chat messages and support requests need a warrant or court order that names them.'
    );
    expect(dataRequestFormError({ ...valid, password: '' })).toBe('Enter your password to release records.');
  });

  test('paperwork status', () => {
    const now = Date.parse('2026-10-05T00:00:00Z');
    expect(paperworkStatus({ paperworkDueAt: null, paperworkReceivedAt: null }, now)).toBeNull();
    expect(paperworkStatus({ paperworkDueAt: '2026-10-06T00:00:00Z', paperworkReceivedAt: null }, now)).toBe('due');
    expect(paperworkStatus({ paperworkDueAt: '2026-10-04T00:00:00Z', paperworkReceivedAt: null }, now)).toBe('overdue');
    expect(paperworkStatus({ paperworkDueAt: '2026-10-04T00:00:00Z', paperworkReceivedAt: '2026-10-04T12:00:00Z' }, now)).toBe('received');
  });
});
```

and in `admin.test.ts`:

```ts
test('data request entries read like sentences and hide the person from admins', () => {
  const release = { ...base, action: 'DATA_RELEASED' as const, targetUserId: null, targetUserName: null,
    details: { agency: 'PNP Lucena', referenceNumber: 'BLT-1', legalBasis: 'WARRANT' } };
  expect(describeAction(release)).toBe('Liza Ramos released records for data request BLT-1 (PNP Lucena, Warrant to Disclose Computer Data)');
  expect(describeAction({ ...release, targetUserName: 'Maria Santos' })).toBe(
    'Liza Ramos released records about Maria Santos for data request BLT-1 (PNP Lucena, Warrant to Disclose Computer Data)'
  );
  expect(describeAction({ ...release, action: 'DATA_RELEASE_VIEWED' })).toBe('Liza Ramos reopened the release for data request BLT-1');
  expect(describeAction({ ...release, action: 'DATA_PAPERWORK_RECEIVED' })).toBe('Liza Ramos recorded the written request for data request BLT-1');
  expect(describeAction({ ...base, actorName: null, action: 'SUPERADMIN_SET', details: { via: 'make-superadmin script' } })).toBe(
    'Server command made Maria Santos the superadmin'
  );
});
```

- [ ] **Step 2: Run** `npx jest -c jest.web.config.mjs src/lib/__tests__/dataRequests.test.ts src/lib/__tests__/admin.test.ts` → FAIL.

- [ ] **Step 3: Implement** `src/lib/dataRequests.ts`:

```ts
// Labels and checks for the superadmin's data requests. The server is the real
// check (dataRequestValidation.js); this explains problems before submitting.
export type DataRequestBasis = 'WARRANT' | 'COURT_ORDER' | 'SUBPOENA' | 'EMERGENCY';

export const BASIS_OPTIONS: { value: DataRequestBasis; label: string }[] = [
  { value: 'WARRANT', label: 'Warrant to Disclose Computer Data' },
  { value: 'COURT_ORDER', label: 'Court order' },
  { value: 'SUBPOENA', label: 'Subpoena' },
  { value: 'EMERGENCY', label: 'Emergency (risk to life)' },
];

export const RELEASE_FOOTER = 'Confidential: released under RA 10173';
export const AUDIT_NOTE = 'This is recorded permanently in the audit log.';

export function basisLabel(b: string): string {
  return BASIS_OPTIONS.find((o) => o.value === b)?.label ?? b;
}

export function allowsContent(b: string): boolean {
  return b === 'WARRANT' || b === 'COURT_ORDER';
}

export interface DataRequestFormValues {
  subjectUserId: string;
  agency: string;
  officerName: string;
  officerContact: string;
  referenceNumber: string;
  legalBasis: string;
  fromDate: string;
  toDate: string;
  includeChats: boolean;
  includeSupport: boolean;
  verificationNote: string;
  password: string;
}

const REQUIRED: [keyof DataRequestFormValues, string][] = [
  ['subjectUserId', 'Choose the person the request is about.'],
  ['agency', 'Add the requesting agency.'],
  ['officerName', 'Add the requesting officer.'],
  ['officerContact', 'Add how to contact the officer.'],
  ['referenceNumber', 'Add the case, blotter or docket number.'],
  ['verificationNote', 'Say how you checked the request is genuine.'],
];

export function dataRequestFormError(v: DataRequestFormValues): string | null {
  for (const [field, message] of REQUIRED) {
    if (!String(v[field]).trim()) return message;
  }
  if (!BASIS_OPTIONS.some((o) => o.value === v.legalBasis)) return 'Choose the legal basis.';
  if (v.legalBasis !== 'EMERGENCY') {
    if (!v.fromDate || !v.toDate) return 'Choose the date range named in the request.';
    if (v.toDate < v.fromDate) return 'The end date must be on or after the start date.';
  }
  if ((v.includeChats || v.includeSupport) && !allowsContent(v.legalBasis)) {
    return 'Chat messages and support requests need a warrant or court order that names them.';
  }
  if (!v.password) return 'Enter your password to release records.';
  return null;
}

export function paperworkStatus(
  r: { paperworkDueAt: string | null; paperworkReceivedAt: string | null },
  now: number = Date.now()
): 'overdue' | 'due' | 'received' | null {
  if (!r.paperworkDueAt) return null;
  if (r.paperworkReceivedAt) return 'received';
  return Date.parse(r.paperworkDueAt) < now ? 'overdue' : 'due';
}

export function tripRoleLabel(role: 'DRIVER' | 'PASSENGER'): string {
  return role === 'DRIVER' ? 'Driver' : 'Passenger';
}
```

`src/lib/admin.ts`: extend the `action` union with `'DATA_RELEASED' | 'DATA_RELEASE_VIEWED' | 'DATA_PAPERWORK_RECEIVED' | 'SUPERADMIN_SET'`; add labels to `ACTION_LABELS` (`SUPERADMIN_SET: 'made', DATA_RELEASED: 'released records', DATA_RELEASE_VIEWED: 'reopened a release', DATA_PAPERWORK_RECEIVED: 'recorded paperwork'`) and, at the top of `describeAction` after `actor`:

```ts
  const ref = typeof a.details?.referenceNumber === 'string' ? a.details.referenceNumber : 'unknown';
  if (a.action === 'DATA_RELEASED') {
    const about = a.targetUserName ? ` about ${a.targetUserName}` : '';
    return `${actor} released records${about} for data request ${ref} (${a.details?.agency}, ${basisLabel(String(a.details?.legalBasis))})`;
  }
  if (a.action === 'DATA_RELEASE_VIEWED') return `${actor} reopened the release for data request ${ref}`;
  if (a.action === 'DATA_PAPERWORK_RECEIVED') return `${actor} recorded the written request for data request ${ref}`;
  if (a.action === 'SUPERADMIN_SET') return `${actor} made ${a.targetUserName ?? 'a deleted user'} the superadmin`;
```

(import `basisLabel` from `./dataRequests`).

- [ ] **Step 4: Run** the web tests → PASS.

- [ ] **Step 5: Navigation and guards.**
  - `layout.tsx`: `<AdminNav showDataRequests={user.isSuperAdmin === true} />`.
  - `AdminNav.tsx`: accept `{ showDataRequests }: { showDataRequests: boolean }`; build `const tabs = showDataRequests ? [...TABS.slice(0, -1), { href: '/auth/admin/data-requests', label: 'Data requests' }, TABS[TABS.length - 1]] : TABS;` and map `tabs`.
  - Every data-request page starts with `const user = await getCurrentUser(); if (!user?.isSuperAdmin) notFound();`.

- [ ] **Step 6: Pages.** Follow the existing admin page patterns (`adminFetch` from `@/app/auth/admin/adminFetch`, `Card`, `Badge`, `formatDateTime`).
  - **List** `data-requests/page.tsx`: heading "Data requests", sub-line "Only you can see this page. Every release is recorded in the audit log.", a "New request" link (`rsu-btn-primary`) to `/auth/admin/data-requests/new`, then a list of cards: `referenceNumber` · `agency`, `basisLabel(legalBasis)`, subject name, `formatDateTime(createdAt)`, and a badge from `paperworkStatus`: overdue → `<Badge tone="warning">Paperwork overdue</Badge>`, due → `<Badge tone="info">Paperwork due {formatDateTime(paperworkDueAt)}</Badge>`, received → `<Badge tone="success">Paperwork received</Badge>`. Each card links to `/auth/admin/data-requests/{id}`. Empty state: "No data requests yet."
  - **Form** `new/DataRequestForm.tsx` (client): a person search (input + button calling `apiFetch('/api/admin/users?q=' + encodeURIComponent(q))`, results as buttons setting `subjectUserId` and showing the chosen name); inputs with stable `id`s for agency, officer name, officer contact, reference number; `<select id="dr-basis">` from `BASIS_OPTIONS`; two `type="date"` inputs hidden when basis is `EMERGENCY` (show instead: "An emergency release shows only the most recent trip, any trip in the next 24 hours and the person's regular trips. The written request is due within 72 hours."); two checkboxes ("The document names trip chat messages", "The document names support requests") `disabled={!allowsContent(basis)}`; a textarea "How did you verify this request?"; a password input; `<p>{AUDIT_NOTE}</p>`; submit button "Release records". On submit: `dataRequestFormError` → inline error; else `apiFetch('/api/admin/data-requests', { method: 'POST', body })`; on success render `<ReleaseView release={...} />` in place of the form plus a link "Back to data requests"; map errors: `INVALID_PASSWORD` → "That password isn't right.", `TOO_MANY_REQUESTS` → "Too many attempts. Try again in a few minutes.", `CANNOT_TARGET_SELF` → "You can't release your own records.", `INVALID_DATA_REQUEST` → "Check the {field} field.", else "Couldn't release the records. Try again."
  - **`ReleaseView.tsx`** (no hooks, usable from server and client): header block with "Records release", agency, officer, reference, `basisLabel`, date range (or "Emergency: minimum information"), generated time; subject block (name, university ID, role, and "This account was deleted; some details were erased." when `deleted`); a table per trip (date and time, repeat pattern for recurring trips, origin → destination, meeting point, status, `tripRoleLabel(subjectRole)`, request status, driver, co-riders, car with plate); chat transcript under a trip when `messages` is not null; support requests section when not null; "No trips in this range." when empty; footer `<p>{RELEASE_FOOTER}</p>`. Wrap wide tables in `overflow-x-auto`. Add a print stylesheet in the component: `@media print { header, nav, .no-print { display: none !important; } }`.
  - **`PrintButton.tsx`** (client): `<button className="rsu-btn-secondary no-print" onClick={() => window.print()}>Print or save as PDF</button>`.
  - **Release page** `[id]/page.tsx`: `adminFetch(/api/admin/data-requests/{id})` → `PrintButton`, a paperwork notice when `paperworkStatus` is `due`/`overdue` ("The written request is due by …" in amber; red text when overdue) with `PaperworkButton` (client, `PATCH .../paperwork`, then `router.refresh()`, label "Written request received"), then `ReleaseView`.

- [ ] **Step 7: Admin user page.**
  - `page.tsx`: type adds `user.isSuperAdmin: boolean`; badges: `{user.isSuperAdmin ? <Badge tone="primary">Superadmin</Badge> : user.isAdmin && <Badge tone="primary">Admin</Badge>}`; remove the joined-trips section and the `joinedMatches` type; retitle the hosted section "Open trips" and add under it `<p className="text-xs text-gray-500">Trip history is released only through a data request.</p>`; pass `canManageAdmins={viewer.isSuperAdmin === true}` and `isSuperAdmin={user.isSuperAdmin}` to `UserActions` (load `viewer` with `getCurrentUser()`).
  - `UserActions.tsx`: render the promote/demote block only when `canManageAdmins`; hide ban controls when `isSuperAdmin`.
  - Overview `page.tsx`: when `overview.overdueDataPaperwork` is a number > 0, a warning card "{n} emergency release{s} still waiting for the written request" linking to `/auth/admin/data-requests`.

- [ ] **Step 8:** `npx tsc --noEmit`, `npm run test:web`, `npx next build` → clean.
- [ ] **Step 9: Commit** `feat: data requests and superadmin controls in the admin console`

---

### Task 6: Seeds and Postman

**Files:**
- Modify: `server/scripts/seedDemo.js` (PEOPLE + user creation), `server/scripts/seedPostman.js` (admin = superadmin, cleanup of `DataRequest`), `postman/RideShareEU.postman_collection.json` (folder 16; switch "Promote the host"/"Demote the host" to still pass with the superadmin token)

- [ ] **Step 1: Demo.** PEOPLE: `liza` gets `isSuperAdmin: true`, `carlo` gets `isAdmin: true`; creation sets `isAdmin: Boolean(p.isAdmin || p.isSuperAdmin), isSuperAdmin: Boolean(p.isSuperAdmin)`. Add one example request so the page isn't empty: after the data exists, create a `DataRequest` by Liza about Rico (`legalBasis: 'SUBPOENA'`, agency "PNP Lucena City Police Station", officer "PCPT R. Dela Peña", contact "(042) 555 0100", reference "BLT-2026-0117", range the last 30 days, `verificationNote: 'Called the station on its listed number and confirmed the request.'`) plus its `DATA_RELEASED` audit row, clearly marked as demo data in a comment.
- [ ] **Step 2: Postman seed.** Admin account: `data: { isAdmin: true, isSuperAdmin: true }`. In `removeExisting`, before deleting users: `await prisma.dataRequest.deleteMany({ where: { OR: [{ createdById: { in: userIds } }, { subjectUserId: { in: userIds } }] } });`.
- [ ] **Step 3: Postman folder "16. Data requests"** (append with a scratchpad builder script like the Women+ one; all requests keep the collection-level < 2 s check):
  1. Superadmin promotes the host → 200 (host becomes a regular admin).
  2. Host (admin) tries to promote the passenger → 403 `SUPERADMIN_ONLY`.
  3. Host (admin) lists data requests → 403 `SUPERADMIN_ONLY`.
  4. Host (admin) tries to ban the superadmin → 409 `TARGET_IS_SUPERADMIN`.
  5. Superadmin releases with a wrong password → 403 `INVALID_PASSWORD`.
  6. Superadmin asks for chats under a subpoena → 400 `{ error: 'INVALID_DATA_REQUEST', field: 'includeChats' }`.
  7. Superadmin releases the passenger's records (WARRANT, range = the run's departure date ± 1 day from `{{departureTime}}`, computed in a pre-request script) → 201; `release.trips.length >= 1`; `JSON.stringify(release)` contains no `@test.local`; save `dataRequestId`.
  8. Superadmin reopens it → 200.
  9. Host (admin) reads the activity log → the newest `DATA_RELEASED` entry has `targetUserId === null`.
  10. Superadmin demotes the host → 200.
  Body passwords use `{{adminPassword}}` from the environment.
- [ ] **Step 4: Run** `npm run seed:postman && npm run test:api` (API on :4000 via the `api` launch config) → 0 failures; note the totals.
- [ ] **Step 5: Commit** `test: add data request checks to the Postman suite and demo data`

---

### Task 7: Docs

**Files:** `docs/policy/law-enforcement-data-requests.md`, `AGENTS.md`, `docs/security/owasp-top10-review.md`, `docs/thesis/thesis-proposal.md`

- [ ] **Step 1: Policy.** Section 2: replace "The app has no 'export a user's history' button…" with: the DPO holds the app's single superadmin account and releases records through Admin console → Data requests, which records the request, re-checks the password, and writes a permanent audit entry; regular admins can't open trip history. Section 7: the app records the request details and each release automatically; the DPO still keeps the request documents. Section 9: remove the export tool from future work; keep the Privacy Policy note.
- [ ] **Step 2: AGENTS.md** new section "Superadmin and data requests (Oct 2026)": flag, `make-superadmin` (and `--replace`), what only the superadmin can do, the four endpoints and error codes, release contents and exclusions, redaction in the activity log, trimmed admin user page, `LAST_SUPERADMIN`, demo (Liza superadmin, Carlo admin), Postman folder 16.
- [ ] **Step 3: OWASP review.** A01: RESOLVED entry "Every admin could promote others and read any user's trip history": least privilege now. A09: the data release audit trail. Keep the audit-trail convention (append, don't rewrite).
- [ ] **Step 4: Manuscript.** `grep -n -i "admin" docs/thesis/thesis-proposal.md`; where the admin role is described, add the superadmin/DPO split and the recorded data-request process in two or three sentences; record changed line numbers for the hand-off.
- [ ] **Step 5: Commit** `docs: describe the superadmin role and the data request process`

---

### Task 8: Regression and browser walkthrough

- [ ] **Step 1:** `npx jest server --forceExit` (twice, to catch parallel-run races), `npm run test:web`, `python -m unittest discover -s validation/labeling`, `npx tsc --noEmit`, `npx next build`, Postman. All green; write down counts.
- [ ] **Step 2:** Reseed `rideshare_demo` (`npx prisma db push` there first), start `api-demo`/`web-demo`, and with Playwright (scratchpad script, `channel: 'msedge'`) check:
  - Carlo (admin): no "Data requests" tab; `/auth/admin/data-requests` → not found; user page has no promote/demote and no trip history, only open trips and the note (A1, A3, A4).
  - Liza (superadmin): tab present; list shows the demo request; New request for Maria under a warrant with a September range → release shows trips, co-riders by name, plate; no emails on the page (S1, S9).
  - Liza: wrong password → "That password isn't right." (S3); subpoena + chats checkbox is disabled (S2).
  - Liza: emergency for Bea → minimum release, paperwork due notice; "Written request received" clears it (S4, S5).
  - Carlo: Activity shows the release without the person's name (A5).
  - Screenshots to the scratchpad. Stay within the demo API's 10 sign-ins per 15 minutes (restart `api-demo` between runs).
- [ ] **Step 3:** Fix anything found (with a test), re-run Step 1.
- [ ] **Step 4:** Update memory; hand off with superpowers:finishing-a-development-branch.

---

## Self-review

- Spec coverage: D1/D4/H1/H2 → Task 1 script; D5 → script sets `isAdmin`; D6/A1 → Task 2 routes; D7/A2/H3 → Tasks 1–2; D8/A3 → Task 2 + Task 5 Step 7; D9/S3 → Task 4; D10/S6 → Task 4 `open`; D11/A5 → Task 2 redaction + Task 5 `describeAction`; D12 → no notification anywhere (Task 7 policy text); §4 model → Task 1; §5 contents → Task 3; S2/S10 → Task 3 validation + Task 4; S4/S5 → Tasks 3–4; S7 → Task 4; S8/S9 → Task 3; H4 → nothing to build (promote/demote just 403 until a superadmin exists; noted in AGENTS.md); §7 UX → Task 5; §9 seeds/Postman/docs → Tasks 6–7.
- Deviation recorded: wrong password is 403, not 401 (Global Constraints).
- Names used across tasks: `isSuperAdmin`, `requireSuperAdmin`, `makeSuperAdmin`, `makeSuperAdminUser`, `redactDataActions`, `validateDataRequest`, `buildRelease`, `paperworkDueAt`, `isOverdue`, `overdueDataPaperwork`, `basisLabel`, `allowsContent`, `dataRequestFormError`, `paperworkStatus`, `RELEASE_FOOTER`, `AUDIT_NOTE` — consistent.

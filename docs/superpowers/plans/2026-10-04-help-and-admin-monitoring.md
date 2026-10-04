# Help, Support Inbox and Admin Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users a Help page (emergency guidance plus a contact-admin form with replies), and give admins a support inbox, announcements, and monitoring (queues with waiting times, today's activity, security counts, a watch list).

**Architecture:** New Prisma models `SupportTicket`, `SupportMessage`, `Announcement` and `SecurityEvent`. Express routes live under `/api/support`, `/api/announcements` and `/api/admin/*`. All rules sit in small services (`supportService`, `watchlistService`, `securityEventStore`) so they can be unit-tested. Frontend: a public `/help` page, `/help/requests` for signed-in users, and new admin tabs (Support, Announcements, Watch list) plus extended Overview cards.

**Tech Stack:** Express 5, Prisma 7 / PostgreSQL 17, Next.js 16 App Router (server components fetch via `@/lib/api-server`, client components via `@/lib/api`), Jest 30 (server against the real local DB with `server/test-helpers/seed.js`; web tests via `jest.web.config.mjs`), Postman/newman.

**Spec:** `docs/superpowers/specs/2026-10-04-help-and-admin-monitoring-design.md`

## Global Constraints

- Ticket categories: `APP_PROBLEM`, `ACCOUNT`, `SAFETY`, `FUEL_SHARE`, `OTHER`. Statuses: `OPEN`, `ANSWERED`, `CLOSED`.
- Subject 1–120 chars; message body 1–2,000 chars; announcement title 1–100, body 1–1,000.
- At most 5 open (OPEN or ANSWERED) tickets per user (429 `TOO_MANY_TICKETS`); at most 10 tickets created per user per 24 h (same error).
- Inbox order: `SAFETY` first, then oldest `updatedAt` first.
- Admin reply → status `ANSWERED`, notification `SUPPORT_REPLY`, audit `SUPPORT_REPLIED`. Admin close → audit `SUPPORT_CLOSED`. Announcement post → audit `ANNOUNCEMENT_POSTED`, one `ANNOUNCEMENT` notification per non-deleted user.
- Security events stored with event, reason, userId, route, createdAt only. **No IP, no email.** Deleted after 30 days.
- Watch-list thresholds (last 30 days): ≥3 passenger cancellations, ≥2 host cancellations after approval, ≥2 reports received; ≥5 `LOGIN_FAILED` on one account in 24 h for the security card.
- Emergency text names **911**. The campus number shows only when `NEXT_PUBLIC_CAMPUS_SECURITY_PHONE` is set. The error-reports link shows only when `ADMIN_ERRORS_URL` is set.
- Admins still cannot read trip chats. No live location anywhere in monitoring.
- Commit as `Xyrus <xyrusdimacali@gmail.com>`, short imperative messages, no AI trailers.

---

## File map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | New enums and models; enum values on `NotificationType` and `AdminActionType` |
| `server/services/supportService.js` | Validation and limits for tickets and messages (pure where possible) |
| `server/controllers/supportController.js` | User ticket routes |
| `server/controllers/admin/supportController.js` | Admin inbox, reply, close |
| `server/routes/supportRoutes.js` | `/api/support` router |
| `server/services/announcementService.js` | Validation; fan-out of notifications |
| `server/controllers/announcementController.js` | User `/api/announcements/active`, admin list/post/end |
| `server/services/securityEventStore.js` | DB sink for `securityLog`, 30-day purge, 24 h counts |
| `server/services/watchlistService.js` | Pattern rules (cancellations, reports) |
| `server/controllers/admin/overviewController.js` | Extended overview; `/watchlist` |
| `server/controllers/admin/userController.js` | User detail adds tickets and security counts |
| `server/services/accountDeletionService.js` | Delete the user's tickets and messages |
| `server/server.js` | Daily purge schedule; install the DB sink |
| `server/test-helpers/seed.js` | Cleanup for the new tables |
| `src/lib/support.ts` | Shared labels, limits, types |
| `src/app/help/page.tsx`, `src/app/help/ContactAdminForm.tsx` | Public Help page with form |
| `src/app/help/requests/page.tsx`, `src/app/help/requests/[id]/page.tsx`, `TicketThread.tsx` | My requests and conversation |
| `src/app/auth/admin/support/*` | Admin inbox and ticket view |
| `src/app/auth/admin/announcements/*` | Post, list and end announcements |
| `src/app/auth/admin/watchlist/page.tsx` | Watch list |
| `src/app/auth/admin/page.tsx` | Overview cards |
| `src/components/AnnouncementBanner.tsx` | Dashboard banner |
| `src/lib/notificationLink.ts`, `src/app/auth/notifications/NotificationsClient.tsx` | New notification types |
| `postman/RideShareEU.postman_collection.json`, `server/scripts/seedDemo.js` | Folder 14; demo ticket and announcement |
| `docs/policy/law-enforcement-data-requests.md`, `AGENTS.md`, manuscript | Docs |

---

### Task 1: Schema and test cleanup

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `server/test-helpers/seed.js` (cleanup)

**Interfaces:**
- Produces: Prisma models `supportTicket`, `supportMessage`, `announcement`, `securityEvent`; enums `SupportCategory`, `SupportStatus`; `NotificationType` += `SUPPORT_REPLY`, `ANNOUNCEMENT`; `AdminActionType` += `SUPPORT_REPLIED`, `SUPPORT_CLOSED`, `ANNOUNCEMENT_POSTED`.

- [ ] **Step 1: Back up the dev DB.** Run `node scripts/backup-db.mjs`.
- [ ] **Step 2: Add the schema.**

```prisma
enum SupportCategory {
  APP_PROBLEM
  ACCOUNT
  SAFETY
  FUEL_SHARE
  OTHER
}

enum SupportStatus {
  OPEN
  ANSWERED
  CLOSED
}

model SupportTicket {
  id            String           @id @default(cuid())
  userId        String
  user          User             @relation("SupportTickets", fields: [userId], references: [id])
  category      SupportCategory
  subject       String
  relatedTripId String?
  status        SupportStatus    @default(OPEN)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  closedAt      DateTime?
  messages      SupportMessage[]

  @@index([status, category, updatedAt])
  @@index([userId, status])
}

model SupportMessage {
  id        String        @id @default(cuid())
  ticketId  String
  ticket    SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  authorId  String
  author    User          @relation("SupportMessages", fields: [authorId], references: [id])
  fromAdmin Boolean
  body      String
  createdAt DateTime      @default(now())

  @@index([ticketId, createdAt])
}

model Announcement {
  id          String    @id @default(cuid())
  title       String
  body        String
  createdById String
  createdBy   User      @relation("Announcements", fields: [createdById], references: [id])
  createdAt   DateTime  @default(now())
  endsAt      DateTime?

  @@index([createdAt])
}

model SecurityEvent {
  id        String   @id @default(cuid())
  event     String
  reason    String?
  userId    String?
  route     String
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@index([event, createdAt])
  @@index([userId, createdAt])
}
```

Add to `model User`: `supportTickets SupportTicket[] @relation("SupportTickets")`, `supportMessages SupportMessage[] @relation("SupportMessages")`, `announcements Announcement[] @relation("Announcements")`. Add the enum values listed under Interfaces.

- [ ] **Step 3: Push and generate.** Run `npx prisma db push && npx prisma generate`, and the same against `rideshare_demo` with `DATABASE_URL` set.
- [ ] **Step 4: Extend `cleanup(bag)`** in `server/test-helpers/seed.js`. Insert these before deleting users:

```js
await prisma.supportMessage.deleteMany({ where: { OR: [{ authorId: { in: bag.userIds } }, { ticket: { userId: { in: bag.userIds } } }] } });
await prisma.supportTicket.deleteMany({ where: { userId: { in: bag.userIds } } });
await prisma.announcement.deleteMany({ where: { createdById: { in: bag.userIds } } });
await prisma.securityEvent.deleteMany({ where: { userId: { in: bag.userIds } } });
```

- [ ] **Step 5: Verify.** Run `npx jest server` and expect all existing tests to pass.
- [ ] **Step 6: Commit** with `feat: add support, announcement and security event tables`.

### Task 2: Store security events (no IP, no email) with a 30-day purge

**Files:**
- Create: `server/services/securityEventStore.js`
- Modify: `server/services/securityLog.js` (multiple sinks)
- Modify: `server/server.js` (install the DB sink; daily purge)
- Test: `server/services/__tests__/securityEventStore.test.js`

**Interfaces:**
- Produces: `addSecurityLogSink(fn) → remove()` in `securityLog.js`.
- Produces: `storeSecurityEvent(entry): Promise<void>`, `purgeOldSecurityEvents(now = new Date()): Promise<number>`, `securityCounts(since: Date): Promise<{ LOGIN_FAILED, OTP_FAILED, OTP_LOCKED, RATE_LIMITED, ACCESS_DENIED, PASSWORD_RECHECK_FAILED }>`, `accountsWithFailedLogins(since: Date, min = 5): Promise<{ userId, count }[]>`.

- [ ] **Step 1: Write the failing tests.**

```js
require('dotenv').config({ quiet: true });
const prisma = require('../../config/db');
const { storeSecurityEvent, purgeOldSecurityEvents, securityCounts, accountsWithFailedLogins } = require('../securityEventStore');

const ids = [];
const userId = `sec-test-${Date.now()}`;
afterAll(async () => {
  await prisma.securityEvent.deleteMany({ where: { OR: [{ id: { in: ids } }, { userId }] } });
  await prisma.$disconnect();
});

const entry = (over = {}) => ({ type: 'security', event: 'LOGIN_FAILED', at: new Date().toISOString(), ip: '203.0.113.9',
  email: 'm***@student.mseuf.edu.ph', route: '/api/auth/verify', userId, reason: 'WRONG_PASSWORD', ...over });

test('stores only event, reason, userId and route — never IP or email', async () => {
  await storeSecurityEvent(entry());
  const row = await prisma.securityEvent.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  ids.push(row.id);
  expect(row).toMatchObject({ event: 'LOGIN_FAILED', reason: 'WRONG_PASSWORD', route: '/api/auth/verify', userId });
  expect(JSON.stringify(row)).not.toContain('203.0.113.9');
  expect(JSON.stringify(row)).not.toContain('student.mseuf');
});

test('counts the last 24 hours by event and flags accounts with 5+ failed sign-ins', async () => {
  for (let i = 0; i < 5; i++) await storeSecurityEvent(entry());
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const counts = await securityCounts(since);
  expect(counts.LOGIN_FAILED).toBeGreaterThanOrEqual(5);
  expect(await accountsWithFailedLogins(since)).toEqual(expect.arrayContaining([{ userId, count: expect.any(Number) }]));
});

test('purges rows older than 30 days', async () => {
  const old = await prisma.securityEvent.create({ data: { event: 'RATE_LIMITED', route: '/x', userId, createdAt: new Date(Date.now() - 31 * 86400000) } });
  await purgeOldSecurityEvents();
  expect(await prisma.securityEvent.findUnique({ where: { id: old.id } })).toBeNull();
});

test('a database error never throws out of storeSecurityEvent', async () => {
  await expect(storeSecurityEvent({ event: 'LOGIN_FAILED', route: null })).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run it.** Run `npx jest server/services/__tests__/securityEventStore.test.js`. Expect FAIL (module missing).
- [ ] **Step 3: Implement** `securityEventStore.js`:

```js
const prisma = require('../config/db');

const RETENTION_DAYS = 30;
const EVENTS = ['LOGIN_FAILED', 'OTP_FAILED', 'OTP_LOCKED', 'RATE_LIMITED', 'PASSWORD_RECHECK_FAILED', 'ACCESS_DENIED'];

// The database copy of the security log keeps as little personal data as
// possible: no IP and no email (the stderr log has those for incident work).
async function storeSecurityEvent(entry) {
  try {
    await prisma.securityEvent.create({
      data: { event: entry.event, reason: entry.reason ?? null, userId: entry.userId ?? null, route: entry.route || '' },
    });
  } catch {
    // Never let monitoring break the request that triggered it.
  }
}

function purgeOldSecurityEvents(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86400000);
  return prisma.securityEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }).then((r) => r.count);
}

async function securityCounts(since) {
  const rows = await prisma.securityEvent.groupBy({ by: ['event'], where: { createdAt: { gte: since } }, _count: { _all: true } });
  const counts = Object.fromEntries(EVENTS.map((e) => [e, 0]));
  for (const r of rows) counts[r.event] = r._count._all;
  return counts;
}

async function accountsWithFailedLogins(since, min = 5) {
  const rows = await prisma.securityEvent.groupBy({
    by: ['userId'],
    where: { event: 'LOGIN_FAILED', userId: { not: null }, createdAt: { gte: since } },
    _count: { _all: true },
  });
  return rows.filter((r) => r._count._all >= min).map((r) => ({ userId: r.userId, count: r._count._all }));
}

module.exports = { storeSecurityEvent, purgeOldSecurityEvents, securityCounts, accountsWithFailedLogins, RETENTION_DAYS };
```

- [ ] **Step 4: Allow several sinks** in `securityLog.js`. Keep `setSecurityLogSink` (tests rely on it) and add `addSecurityLogSink`. `logSecurityEvent` calls the main sink and then each extra sink, each in its own `try`:

```js
const extraSinks = new Set();
function addSecurityLogSink(fn) { extraSinks.add(fn); return () => extraSinks.delete(fn); }
// in logSecurityEvent, after sink(entry):
for (const extra of extraSinks) { try { extra(entry); } catch { /* ignore */ } }
```

Export `addSecurityLogSink`.

- [ ] **Step 5: Wire it into `server/server.js`,** inside the existing `if (process.env.NODE_ENV !== 'test')` block:

```js
const { addSecurityLogSink } = require('./services/securityLog');
const { storeSecurityEvent, purgeOldSecurityEvents } = require('./services/securityEventStore');
addSecurityLogSink((entry) => { storeSecurityEvent(entry); });
cron.schedule('30 3 * * *', () => {
  purgeOldSecurityEvents().catch((err) => console.error(`[security-events] purge failed: ${err.message}`));
});
```

- [ ] **Step 6: Run the tests.** Run the new test, `server/services/__tests__/securityLog.test.js` and `server/__tests__/securityLogging.test.js`. Expect PASS.
- [ ] **Step 7: Commit** with `feat: keep 30 days of security events for admin monitoring`.

### Task 3: Support tickets: user API

**Files:**
- Create: `server/services/supportService.js`, `server/controllers/supportController.js`, `server/routes/supportRoutes.js`
- Modify: `server/app.js` (`app.use('/api/support', supportRoutes)`)
- Test: `server/services/__tests__/supportService.test.js`, `server/__tests__/support.test.js`

**Interfaces:**
- Produces: `SUPPORT_CATEGORIES`, `MAX_OPEN_TICKETS = 5`, `MAX_TICKETS_PER_DAY = 10`, `SUBJECT_MAX = 120`, `BODY_MAX = 2000`, `validateTicketInput(body) → { data } | { field }`, `validateMessageBody(body) → string | null`.
- Routes:
  - `POST /api/support` → 201 `{ ticket }`
  - `GET /api/support` → `{ tickets }`
  - `GET /api/support/:id` → `{ ticket }`, which includes `messages` in time order
  - `POST /api/support/:id/messages` → 201 `{ message, ticket }`
  - `PATCH /api/support/:id/close` → `{ ticket }`

- [ ] **Step 1: Unit tests** for `supportService` cover:
  - valid input returns `{ data }` with a trimmed subject and body
  - an unknown category returns `{ field: 'category' }`
  - an empty or 121-char subject returns `subject`
  - a 2,001-char body returns `body`
  - a non-string `relatedTripId` returns `relatedTripId`
  - `validateMessageBody('  ')` returns null and `'ok'` returns `'ok'`
- [ ] **Step 2: Integration tests** (`server/__tests__/support.test.js`), using `makeUser`, `makeVehicle`, `makeTrip`, `makeMatch` and `bearer`:
  - **T2:** create → 201, status OPEN, one message stored
  - **T3:** `relatedTripId` of another user's trip → 403 `TRIP_NOT_YOURS`; own hosted trip → 201; trip joined as approved passenger → 201
  - **T4:** five open tickets, then the 6th → 429 `TOO_MANY_TICKETS`
  - list returns only the caller's tickets
  - **T9:** GET of another user's ticket → 404 `TICKET_NOT_FOUND`
  - **T7:** reply on ANSWERED → status OPEN (set ANSWERED via prisma first)
  - **T8:** reply on CLOSED → 409 `TICKET_CLOSED`
  - close → status CLOSED with `closedAt` set; closing again → 409 `TICKET_CLOSED`
- [ ] **Step 3: Run.** Expect FAIL.
- [ ] **Step 4: Implement** the service, controller and routes. Key controller logic:

```js
// create
const { data, field } = validateTicketInput(req.body);
if (field) return res.status(400).json({ error: 'INVALID_TICKET', field });
if (data.relatedTripId && !(await isOwnTrip(data.relatedTripId, req.user.id))) return res.status(403).json({ error: 'TRIP_NOT_YOURS' });
const [open, today] = await Promise.all([
  prisma.supportTicket.count({ where: { userId: req.user.id, status: { in: ['OPEN', 'ANSWERED'] } } }),
  prisma.supportTicket.count({ where: { userId: req.user.id, createdAt: { gte: new Date(Date.now() - 86400000) } } }),
]);
if (open >= MAX_OPEN_TICKETS || today >= MAX_TICKETS_PER_DAY) return res.status(429).json({ error: 'TOO_MANY_TICKETS' });
const ticket = await prisma.supportTicket.create({
  data: { userId: req.user.id, category: data.category, subject: data.subject, relatedTripId: data.relatedTripId,
    messages: { create: { authorId: req.user.id, fromAdmin: false, body: data.body } } },
  include: { messages: true },
});
res.status(201).json({ ticket });
```

`isOwnTrip(tripId, userId)`: true if the trip's `hostId === userId`, or there's a match with `passengerId = userId` and status in `['PENDING', 'APPROVED', 'COMPLETED']`.

- [ ] **Step 5: Run** both test files. Expect PASS.
- [ ] **Step 6: Commit** with `feat: let users contact admins through support tickets`.

### Task 4: Support tickets: admin inbox, reply, close

**Files:**
- Create: `server/controllers/admin/supportController.js`
- Modify: `server/routes/adminRoutes.js`
- Test: `server/__tests__/adminSupport.test.js`

**Interfaces:**
- Consumes: `record(tx, {...})` from `adminActionService`; `validateMessageBody` from Task 3.
- Routes:
  - `GET /api/admin/support?status=OPEN|ANSWERED|CLOSED` → `{ tickets }`, each `{ id, category, subject, status, createdAt, updatedAt, user: { id, fullName }, messageCount }`
  - `GET /api/admin/support/:id` → `{ ticket }` with messages (author names), user and `relatedTrip` summary (`{ id, destinationAddress, departureTime, status }`, decrypted)
  - `POST /api/admin/support/:id/messages` → 201
  - `PATCH /api/admin/support/:id/close`

- [ ] **Step 1: Tests:**
  - **T5:** an OPEN SAFETY ticket and an older OPEN APP_PROBLEM ticket → SAFETY listed first
  - **T6:** reply → status ANSWERED, a `SUPPORT_REPLY` notification exists for the ticket owner, and an `AdminAction` `SUPPORT_REPLIED` row has `targetUserId` = owner and `details.ticketId`
  - close → CLOSED plus `SUPPORT_CLOSED` audit
  - **T10:** a regular user on `/api/admin/support` → 403 `ADMIN_ONLY`
  - reply on a CLOSED ticket → 409 `TICKET_CLOSED`
  - empty body → 400 `INVALID_MESSAGE`
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement.** Sort in JS after fetching (open queues are small): `tickets.sort((a, b) => (b.category === 'SAFETY') - (a.category === 'SAFETY') || a.updatedAt - b.updatedAt)`. Reply in one transaction: create the message, update the status, create the notification `{ userId: ticket.userId, type: 'SUPPORT_REPLY', message: \`An admin replied to your request "${ticket.subject}".\` }`, then call `record(tx, { actorId: req.user.id, action: 'SUPPORT_REPLIED', targetUserId: ticket.userId, details: { ticketId: ticket.id } })`.
- [ ] **Step 4: Run.** Expect PASS.
- [ ] **Step 5: Commit** with `feat: add the admin support inbox`.

### Task 5: Announcements

**Files:**
- Create: `server/services/announcementService.js`, `server/controllers/announcementController.js`
- Modify: `server/app.js` (`app.get('/api/announcements/active', active)`), `server/routes/adminRoutes.js`
- Test: `server/__tests__/announcements.test.js`

**Interfaces:**
- Produces: `validateAnnouncement(body) → { data } | { field }` (title 1–100, body 1–1,000, optional `endsAt` ISO in the future).
- Routes:
  - `GET /api/announcements/active` → `{ announcements }` (not ended, newest first, max 3)
  - `GET /api/admin/announcements` → `{ announcements }` (latest 50)
  - `POST /api/admin/announcements` → 201
  - `PATCH /api/admin/announcements/:id/end`

- [ ] **Step 1: Tests:**
  - **T12:** post → 201; every non-deleted user (check two seeded users) has an `ANNOUNCEMENT` notification whose message starts with the title; `ANNOUNCEMENT_POSTED` audit row
  - **T13:** `endsAt` in the past at post time → 400 `INVALID_ANNOUNCEMENT` (field `endsAt`); a row with `endsAt` already past (set via prisma) is not in `/active`
  - end → no longer in `/active`
  - a non-admin post → 403
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement.** Fan-out inside the transaction:

```js
const users = await tx.user.findMany({ where: { deletedAt: null }, select: { id: true } });
await tx.notification.createMany({
  data: users.map((u) => ({ userId: u.id, type: 'ANNOUNCEMENT', message: `${data.title}: ${data.body}`.slice(0, 500) })),
});
```

End sets `endsAt = now`.

- [ ] **Step 4: Run.** Expect PASS.
- [ ] **Step 5: Commit** with `feat: let admins post announcements to all users`.

### Task 6: Monitoring: overview, watch list, user detail

**Files:**
- Create: `server/services/watchlistService.js`
- Modify: `server/controllers/admin/overviewController.js`, `server/controllers/admin/userController.js`, `server/routes/adminRoutes.js`
- Test: `server/services/__tests__/watchlistService.test.js`, `server/__tests__/adminMonitoring.test.js`

**Interfaces:**
- Produces: `buildWatchlist(since: Date) → Promise<{ userId, fullName, reasons: string[] }[]>`, with constants `PASSENGER_CANCEL_MIN = 3`, `HOST_CANCEL_MIN = 2`, `REPORTS_MIN = 2`.
- `GET /api/admin/overview` adds:
  - `queues: { openReports, oldestReportAt, openTickets, safetyTickets, oldestTicketAt }`
  - `today: { ridesToday, newUsers24h, activeBans }`
  - `security: { counts, flaggedAccounts: [{ userId, fullName, count }] }`
  - `watchlistCount`
  - `errorsUrl` (from `ADMIN_ERRORS_URL` or null)
- `GET /api/admin/watchlist` → `{ users }`.
- `GET /api/admin/users/:id` adds `supportTickets` (id, subject, status, createdAt) and `securityCounts30d`.

Rules, all in the last 30 days:
- **Passenger cancellations:** matches with status `CANCELLED` whose trip is not `CANCELLED`, counted by `passengerId`. Use the existing `respondedAt` or `createdAt` within the window.
- **Host cancellations:** trips with status `CANCELLED`, `cancelledAt` in the window, at least one match that was `APPROVED` or `CANCELLED` after approval, and no `TRIP_CANCELLED` AdminAction targeting that trip. Admin cancellations don't count (T18).
- **Reports received:** at least 2, any status.

Reason text: `"4 passenger cancellations in 30 days"`, `"2 trips cancelled after riders were approved"`, `"2 reports received"`.

- [ ] **Step 1: Tests:**
  - **T17:** 3 cancelled matches for one passenger on non-cancelled trips → in the watch list with the passenger reason
  - **T18:** a trip cancelled by an admin (AdminAction `TRIP_CANCELLED`) → host not flagged
  - 2 reports → flagged
  - **T19:** overview `oldestReportAt` equals the oldest OPEN report's `createdAt`
  - **T14:** 5 `LOGIN_FAILED` events stored for a user → in `security.flaggedAccounts`
  - **T20:** `errorsUrl` is null when the env var is unset
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement** with Prisma queries, using `groupBy` for counts and names via `decryptField`. "Rides today" = trips with status in `OPEN`/`FULL`/`COMPLETED` whose `departureTime` falls within today in Asia/Manila (compute the UTC start and end of the PH day) or whose `recurrenceType` runs today (reuse `tripRunsOnSearchDate` from the match controller's helper if exported; otherwise count one-time only and label it "one-time rides today").
- [ ] **Step 4: Run.** Expect PASS.
- [ ] **Step 5: Commit** with `feat: show queues, today's activity, security counts and a watch list to admins`.

### Task 7: Account deletion removes support tickets

**Files:**
- Modify: `server/services/accountDeletionService.js` (inside the transaction, before the user update)
- Test: `server/__tests__/accountDeletion.test.js` (add a case)

- [ ] **Step 1: Test (T11):** a user with a ticket and a message → after `DELETE /api/users/me`, no `SupportTicket` rows remain for them.
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement.** Add `await tx.supportTicket.deleteMany({ where: { userId } });` (messages cascade) and `await tx.supportMessage.deleteMany({ where: { authorId: userId } });`.
- [ ] **Step 4: Run.** Expect PASS.
- [ ] **Step 5: Commit** with `fix: delete a user's support tickets with their account`.

### Task 8: Help page, contact form and My requests

**Files:**
- Create: `src/lib/support.ts`, `src/lib/__tests__/support.test.ts`
- Create: `src/app/help/page.tsx` (server component, public), `src/app/help/ContactAdminForm.tsx` (client)
- Create: `src/app/help/requests/page.tsx`, `src/app/help/requests/[id]/page.tsx`, `src/app/help/requests/[id]/TicketThread.tsx`
- Modify: `src/lib/notificationLink.ts` (+ `SUPPORT_REPLY` → `/help/requests` and `ANNOUNCEMENT` → null), `src/app/auth/notifications/NotificationsClient.tsx` (types and icons)
- Modify: entry points: `src/components/Header.tsx` (desktop "Help" link), the profile page ("Help and support" card), `src/app/login/page.tsx` and `src/app/register/page.tsx` (footer link), `src/components/BannedScreen.tsx` ("Contact admin" link)

**Interfaces:**
- `src/lib/support.ts` exports:
  - `SUPPORT_CATEGORIES` with labels: Problem with the app, Account or sign-in, Safety concern, Fuel share, Other
  - `SUPPORT_STATUS_LABELS`
  - `SUBJECT_MAX`, `BODY_MAX`
  - `supportFormError(values) → string | null`
  - `campusSecurityPhone(): string | null` (reads `process.env.NEXT_PUBLIC_CAMPUS_SECURITY_PHONE`, trimmed, null if empty)

- [ ] **Step 1: Web tests** for `supportFormError`:
  - missing category or subject, or an empty message → returns a message
  - a 121-char subject → `"Keep the subject under 120 characters."`
  - valid → null
  - `campusSecurityPhone()` → null when unset; the value when set
- [ ] **Step 2: Run.** Run `npx jest -c jest.web.config.mjs src/lib/__tests__/support.test.ts`. Expect FAIL, then implement and expect PASS.
- [ ] **Step 3: Help page**, in this order:
  1. An emergency card (red border): "In an emergency", "If you or someone else is in danger, call **911** now or go to the nearest police station. RideShareEU admins can't respond to emergencies.", plus the campus line when configured.
  2. "Report a rider": explains the Report button on trips and profiles.
  3. "Contact admin": `ContactAdminForm` when signed in (via `getCurrentUser()`), otherwise "Sign in to contact an admin" linking to `/login?next=/help`.
  4. A link to "My requests".

  `ContactAdminForm` has a category select, a subject input, a message textarea with a counter, and an optional trip select filled from `GET /api/trips/mine` (hosted and joined, upcoming and recent). On submit it calls `POST /api/support`. On success it shows "Sent. You'll get a notification when an admin replies." with a link to the request. Error mapping:
  - `TOO_MANY_TICKETS` → "You have several open requests. Wait for a reply or close one first."
  - `INVALID_TICKET` → field-specific text
- [ ] **Step 4: My requests pages.** The list shows subject, category label, status badge and last updated. The thread shows messages (yours on the right, the admin's labelled "Admin"), a reply box hidden when CLOSED, and a "Close request" button.
- [ ] **Step 5: Entry points and notification types.** `notificationHref({ type: 'SUPPORT_REPLY' })` → `/help/requests`. Extend the existing `notificationLink` test if one exists, else add a case to `src/lib/__tests__/support.test.ts`.
- [ ] **Step 6: Browser check** with the demo servers (`api-demo`, `web-demo`):
  - signed out: `/help` shows the emergency card and a sign-in prompt
  - as Maria: send a ticket and see it in My requests
- [ ] **Step 7: Run** `npx tsc --noEmit` and the web tests, then commit with `feat: add a Help page with contact-admin requests`.

### Task 9: Admin Support tab

**Files:**
- Create: `src/app/auth/admin/support/page.tsx` (inbox with status tabs, same pattern as `reports/page.tsx`), `src/app/auth/admin/support/[id]/page.tsx`, `src/app/auth/admin/support/[id]/AdminTicketReply.tsx`
- Modify: `src/app/auth/admin/AdminNav.tsx` (add Support, Announcements, Watch list), `src/lib/admin.ts` (`describeAction` for `SUPPORT_REPLIED`, `SUPPORT_CLOSED`, `ANNOUNCEMENT_POSTED`; `ACTION_LABELS` entries)

- [ ] **Step 1:** Inbox rows show a SAFETY badge (red), subject, the user's name, category, and the waiting time ("waiting 2 days", via a small `waitingLabel(iso, now)` helper in `src/lib/admin.ts` with a web test: under 1 h → "waiting under an hour", 5 h → "waiting 5 hours", 49 h → "waiting 2 days").
- [ ] **Step 2:** The ticket page shows the thread, the related trip summary with a link to `/auth/trips/:id`, a link to the user's admin page, the reply box (`POST /api/admin/support/:id/messages`, then `router.refresh()`) and a Close button.
- [ ] **Step 3:** Activity log text: "Liza Ramos replied to a support request from Maria Santos", "… closed a support request from …", "… posted an announcement".
- [ ] **Step 4:** Browser check: Liza answers Maria's ticket; Maria gets the notification and sees the reply.
- [ ] **Step 5:** Run tsc and the web tests, then commit with `feat: add the admin Support tab`.

### Task 10: Announcements UI

**Files:**
- Create: `src/app/auth/admin/announcements/page.tsx`, `src/app/auth/admin/announcements/AnnouncementForm.tsx`, `src/components/AnnouncementBanner.tsx`
- Modify: `src/app/auth/dashboard/page.tsx` (render the banner at the top)

- [ ] **Step 1:** Admin page: the form (title, message, optional end date and time in PH time) shows a preview, then a confirm "Send to all users?" step built into the page (not `window.confirm`). Below it, the list with "Active" or "Ended" and an "End now" button.
- [ ] **Step 2:** `AnnouncementBanner` (client) fetches `/api/announcements/active` and shows the newest one not dismissed. Dismissed ids live in `localStorage` key `rsu-dismissed-announcements`, wrapped in try/catch. It has a dismiss button with `aria-label="Dismiss announcement"`.
- [ ] **Step 3:** Browser check: Liza posts "No classes tomorrow"; Maria sees the banner and the notification; ending it removes the banner.
- [ ] **Step 4:** Run tsc and the web tests, then commit with `feat: show admin announcements on the dashboard`.

### Task 11: Overview cards and Watch list page

**Files:**
- Modify: `src/app/auth/admin/page.tsx`
- Create: `src/app/auth/admin/watchlist/page.tsx`
- Modify: `src/app/auth/admin/users/[id]/page.tsx` (support tickets and security counts)

- [ ] **Step 1:** Overview cards in the order Needs attention, Today, Security (24 h), Watch list, System, then the existing tiles and recent activity, all using `waitingLabel`. Hide System when `errorsUrl` is null.
- [ ] **Step 2:** Watch list page: a row per user (name linked to their admin page, reasons as plain text), with an empty state "No one needs a closer look right now." and a footnote "Flags only. Nothing here happens automatically."
- [ ] **Step 3:** Browser check with demo data (Rico has a report; add a second report in the demo seed so he's flagged).
- [ ] **Step 4:** Run tsc and the web tests, then commit with `feat: show monitoring cards and the watch list in the admin console`.

### Task 12: Postman, demo seed, docs, full regression

**Files:**
- Modify: `postman/RideShareEU.postman_collection.json` (folder "14. Help and support")
- Modify: `server/scripts/seedDemo.js` (one SAFETY ticket from Bea with an admin reply; one active announcement; a second report on Rico)
- Create: `docs/policy/law-enforcement-data-requests.md`
- Modify: `AGENTS.md` (Help and monitoring section), `docs/thesis/thesis-proposal.md` (system features: help, support inbox, announcements, monitoring), `.env.example` (`NEXT_PUBLIC_CAMPUS_SECURITY_PHONE`, `ADMIN_ERRORS_URL`)

- [ ] **Step 1:** Postman folder, in order:
  1. passenger creates a ticket → 201, saved `ticketId`
  2. lists their tickets
  3. tries an admin route → 403
  4. admin lists the inbox (contains `ticketId`)
  5. admin replies → status ANSWERED
  6. passenger replies → OPEN
  7. admin closes
  8. admin posts an announcement with `endsAt` 1 hour ahead → 201
  9. passenger reads `/api/announcements/active`
  10. admin ends it

  Every request asserts a response under 2 s. Use the existing logins (no new sign-ins).
- [ ] **Step 2:** Policy doc sections:
  1. Scope
  2. Who handles requests (the MSEUF Data Protection Officer; not regular admins)
  3. What a request must include (officer, unit, case or blotter number, legal basis: a Warrant to Disclose Computer Data under A.M. No. 17-11-03-SC, or another court order)
  4. Emergency path (credible risk to life: minimum data first, paperwork after)
  5. What RideShareEU holds (planned trips, matches, vehicle; no GPS trail; chats only under warrant; deleted accounts already anonymized)
  6. Minimum necessary (RA 10173)
  7. Record keeping
  8. Retention (to be set by the team; recommendation 1 year)
  9. Future work (DPO-only export)

  Note it is not legal advice and should be confirmed with the MSEUF DPO or legal office.
- [ ] **Step 3:** Run the full regression: `npm test`, `python -m unittest discover -s validation/labeling`, `npm run seed:postman && npm run test:api` (restart the API first), and `npx tsc --noEmit`.
- [ ] **Step 4:** Browser walkthrough of T1–T20 with the demo accounts. Take screenshots of the Help page, the inbox, the overview and the watch list.
- [ ] **Step 5:** Commit the docs with `docs: describe help, support and monitoring, and the data request policy`, then merge into main once everything passes.

---

## Self-review

- Spec coverage:

  | Spec section | Plan task(s) |
  |---|---|
  | §2 goals | 3–6, 8–11 |
  | H1 | 8 |
  | H2 | 8 (`campusSecurityPhone`) |
  | H3 | 3 |
  | H4 | 3 (`isOwnTrip`) |
  | H5 | 3 |
  | H6 | 3, 4, 8 |
  | H7 | 4 |
  | H8 | 7 |
  | M1 | 2 |
  | M2 | 6 |
  | M3 | 5, 10 |
  | M4 | 6, 11 |
  | §8 T1–T20 | Tasks 2–8 tests plus Task 12 walkthrough |
  | §9 docs and policy | 12 |

- Names used across tasks:
  - `validateMessageBody` (3 → 4)
  - `record` (4, 5)
  - `waitingLabel` (9 → 11)
  - `securityCounts` and `accountsWithFailedLogins` (2 → 6)
  - `addSecurityLogSink` (2)
- Open choice inside Task 6: "rides today" counts recurring trips only if the existing date helper can be reused; otherwise it is labelled one-time. That choice is recorded in the task.

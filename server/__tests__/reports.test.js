require('dotenv').config({ quiet: true }); // jest doesn't load .env the way server.js does
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// POST /api/reports and the automated ban ladder it triggers
// (server/services/reportEnforcementService.js) + the ban check in
// server/middleware/authenticate.js. No admin review exists anywhere in this
// flow — every assertion here is about what the system does on its own.

let server;
let base;
let dbUp = false;

// Enforcement sends a real ban-notification email (emailService.sendBanNotificationEmail)
// whenever a test in this file actually triggers a ban — and .env has a real
// Gmail SMTP_HOST every test file loads via dotenv (see authFlows.test.js's
// header comment for the full explanation). Deleting it for this file's
// duration forces the dev-only console.log fallback instead of real sends to
// throwaway @test.local addresses.
const ORIGINAL_SMTP_HOST = process.env.SMTP_HOST;

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch (e) {
    console.warn('[reports.test] no database reachable — skipping integration assertions:', e.code || e.message);
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  delete process.env.SMTP_HOST;
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});

  if (ORIGINAL_SMTP_HOST === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = ORIGINAL_SMTP_HOST;
  expect(process.env.SMTP_HOST).toBe(ORIGINAL_SMTP_HOST);
});

// Makes `user` a "qualifying" reporter per reportEnforcementService's gate —
// verified is already true from makeUser, so the missing half is tripCount.
async function makeQualifying(user) {
  await prisma.user.update({ where: { id: user.id }, data: { tripCount: 1 } });
}

async function postReport(callerId, body) {
  return fetch(`${base}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(callerId) },
    body: JSON.stringify(body),
  });
}

describe('POST /api/reports — report a user (profile flow)', () => {
  test('requires an existing match between reporter and target — 403 NOT_MATCHED otherwise', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const a = await makeUser(bag);
    const b = await makeUser(bag);
    try {
      const res = await postReport(a.id, { reportedUserId: b.id, category: 'SPAM' });
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('NOT_MATCHED');
    } finally {
      await cleanup(bag);
    }
  });

  test('a real match relationship allows the report — 201, and it never leaks anything back', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const host = await makeUser(bag);
    const passenger = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    await makeMatch(bag, trip.id, passenger.id);
    try {
      const res = await postReport(passenger.id, { reportedUserId: host.id, category: 'SPAM', description: 'late' });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toEqual({ status: 'REPORT_SUBMITTED' });
    } finally {
      await cleanup(bag);
    }
  });

  test('cannot report yourself — 400', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const a = await makeUser(bag);
    try {
      const res = await postReport(a.id, { reportedUserId: a.id, category: 'OTHER' });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('CANNOT_REPORT_SELF');
    } finally {
      await cleanup(bag);
    }
  });

  test('invalid category → 400 INVALID_CATEGORY', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const a = await makeUser(bag);
    const b = await makeUser(bag);
    try {
      const res = await postReport(a.id, { reportedUserId: b.id, category: 'NOT_A_REAL_CATEGORY' });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('INVALID_CATEGORY');
    } finally {
      await cleanup(bag);
    }
  });

  test('description over 500 chars → 400 DESCRIPTION_TOO_LONG', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const host = await makeUser(bag);
    const passenger = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    await makeMatch(bag, trip.id, passenger.id);
    try {
      const res = await postReport(passenger.id, {
        reportedUserId: host.id,
        category: 'OTHER',
        description: 'x'.repeat(501),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('DESCRIPTION_TOO_LONG');
    } finally {
      await cleanup(bag);
    }
  });

  test('the reported user never learns a report exists — their own profile fetch stays unaffected', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const host = await makeUser(bag);
    const passenger = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    await makeMatch(bag, trip.id, passenger.id);
    try {
      await postReport(passenger.id, { reportedUserId: host.id, category: 'HARASSMENT' });
      // The host (now banned via HIGH_ALERT — see the enforcement suite below)
      // fetching their OWN profile must never see a report-shaped field. Note:
      // `canReport` itself is fine to expose — it tells a VIEWER whether THEY
      // can file a report, not whether one exists against the profile owner —
      // so it's named explicitly here rather than caught by a blanket
      // substring match, which would (and did) false-positive on it.
      const res = await fetch(`${base}/api/users/${host.id}`, { headers: bearer(host.id) });
      const body = await res.json();
      const leakyKeys = ['reporterId', 'reportedBy', 'reports', 'reportCount', 'reportIds'];
      expect(Object.keys(body.user).some((k) => leakyKeys.includes(k))).toBe(false);
    } finally {
      await cleanup(bag);
    }
  });
});

describe('POST /api/reports — report a trip/ride issue (match flow)', () => {
  test('passenger reporting derives reportedUserId as the host, ignoring any client-sent value', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const host = await makeUser(bag);
    const passenger = await makeUser(bag);
    const stranger = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    const match = await makeMatch(bag, trip.id, passenger.id);
    try {
      // Client tries to lie about who's being reported — server must ignore it.
      const res = await postReport(passenger.id, { matchId: match.id, reportedUserId: stranger.id, category: 'NO_SHOW' });
      expect(res.status).toBe(201);
      const report = await prisma.report.findFirst({ where: { reportedMatchId: match.id } });
      expect(report.reportedUserId).toBe(host.id);
      expect(report.reportedUserId).not.toBe(stranger.id);
    } finally {
      await cleanup(bag);
    }
  });

  test('host reporting derives reportedUserId as that specific passenger', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const host = await makeUser(bag);
    const passenger = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    const match = await makeMatch(bag, trip.id, passenger.id);
    try {
      const res = await postReport(host.id, { matchId: match.id, category: 'INAPPROPRIATE_BEHAVIOR' });
      expect(res.status).toBe(201);
      const report = await prisma.report.findFirst({ where: { reportedMatchId: match.id } });
      expect(report.reportedUserId).toBe(passenger.id);
    } finally {
      await cleanup(bag);
    }
  });

  test('a non-participant reporting a match → 403 NOT_A_PARTICIPANT', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const host = await makeUser(bag);
    const passenger = await makeUser(bag);
    const stranger = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    const match = await makeMatch(bag, trip.id, passenger.id);
    try {
      const res = await postReport(stranger.id, { matchId: match.id, category: 'OTHER' });
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('NOT_A_PARTICIPANT');
    } finally {
      await cleanup(bag);
    }
  });

  test('a nonexistent match → 404 MATCH_NOT_FOUND', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const a = await makeUser(bag);
    try {
      const res = await postReport(a.id, { matchId: 'does-not-exist', category: 'OTHER' });
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe('MATCH_NOT_FOUND');
    } finally {
      await cleanup(bag);
    }
  });
});

describe('Automated enforcement — flat strike ladder', () => {
  // Builds `count` distinct qualifying reporters, each with a real match to
  // `target` (satisfying the report-a-user flow's own NOT_MATCHED gate), and
  // has each of them file one report in the given category.
  async function fileDistinctReports(bag, target, count, category) {
    for (let i = 0; i < count; i++) {
      const reporter = await makeUser(bag);
      await makeQualifying(reporter);
      const vehicle = await makeVehicle(bag, reporter.id);
      const trip = await makeTrip(bag, reporter.id, vehicle.id);
      await makeMatch(bag, trip.id, target.id);
      const res = await postReport(reporter.id, { reportedUserId: target.id, category });
      expect(res.status).toBe(201);
    }
  }

  test('1st distinct qualifying strike → 24h suspension', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const target = await makeUser(bag);
    try {
      await fileDistinctReports(bag, target, 1, 'SPAM');
      const updated = await prisma.user.findUnique({ where: { id: target.id } });
      expect(updated.banSeverity).toBe('STANDARD');
      const hoursLeft = (updated.bannedUntil.getTime() - Date.now()) / (60 * 60 * 1000);
      expect(hoursLeft).toBeGreaterThan(23);
      expect(hoursLeft).toBeLessThanOrEqual(24);
    } finally {
      await cleanup(bag);
    }
  });

  test('5 reports from the SAME reporter count as 1 strike, not 5 — no ban yet', async () => {
    // Slower than the file's default 5s: 5 sequential postReport round trips,
    // each running the full create + abuse-guard + enforcement-evaluate chain.
    if (!dbUp) return;
    const bag = newBag();
    const target = await makeUser(bag);
    const reporter = await makeUser(bag);
    await makeQualifying(reporter);
    try {
      for (let i = 0; i < 5; i++) {
        // A fresh match each time isn't required for the report-a-user flow to
        // keep succeeding, but the point under test is the strike count, so
        // one match between reporter and target is enough for all 5 posts.
        if (i === 0) {
          const vehicle = await makeVehicle(bag, reporter.id);
          const trip = await makeTrip(bag, reporter.id, vehicle.id);
          await makeMatch(bag, trip.id, target.id);
        }
        await postReport(reporter.id, { reportedUserId: target.id, category: 'SPAM' });
      }
      const updated = await prisma.user.findUnique({ where: { id: target.id } });
      // 1 distinct qualifying reporter = 1st-strike tier (24h), not escalated
      // further despite 5 raw report rows.
      expect(updated.banSeverity).toBe('STANDARD');
      const hoursLeft = (updated.bannedUntil.getTime() - Date.now()) / (60 * 60 * 1000);
      expect(hoursLeft).toBeLessThanOrEqual(24);
    } finally {
      await cleanup(bag);
    }
  }, 30000);

  test('a non-qualifying reporter (tripCount 0) never triggers a ban', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const target = await makeUser(bag);
    const reporter = await makeUser(bag); // NOT made qualifying — tripCount stays 0
    const vehicle = await makeVehicle(bag, reporter.id);
    const trip = await makeTrip(bag, reporter.id, vehicle.id);
    await makeMatch(bag, trip.id, target.id);
    try {
      const res = await postReport(reporter.id, { reportedUserId: target.id, category: 'HARASSMENT' });
      expect(res.status).toBe(201);
      const updated = await prisma.user.findUnique({ where: { id: target.id } });
      expect(updated.bannedUntil).toBeNull();
    } finally {
      await cleanup(bag);
    }
  });

  test('2nd distinct strike → 7 days, 3rd → 30 days, 4th → permanent', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const target = await makeUser(bag);
    try {
      await fileDistinctReports(bag, target, 1, 'SPAM');
      let updated = await prisma.user.findUnique({ where: { id: target.id } });
      let daysLeft = (updated.bannedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(daysLeft).toBeLessThanOrEqual(1);

      await fileDistinctReports(bag, target, 1, 'SPAM');
      updated = await prisma.user.findUnique({ where: { id: target.id } });
      daysLeft = (updated.bannedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(daysLeft).toBeGreaterThan(6);
      expect(daysLeft).toBeLessThanOrEqual(7);

      await fileDistinctReports(bag, target, 1, 'SPAM');
      updated = await prisma.user.findUnique({ where: { id: target.id } });
      daysLeft = (updated.bannedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(daysLeft).toBeGreaterThan(29);
      expect(daysLeft).toBeLessThanOrEqual(30);

      await fileDistinctReports(bag, target, 1, 'SPAM');
      updated = await prisma.user.findUnique({ where: { id: target.id } });
      expect(updated.banSeverity).toBe('HIGH_ALERT');
      expect(updated.bannedUntil.getUTCFullYear()).toBeGreaterThanOrEqual(9999);
    } finally {
      await cleanup(bag);
    }
  }, 30000); // 4 rounds of fileDistinctReports — same sequential-round-trip cost as the test above

  test('a single qualifying HARASSMENT report jumps straight to permanent', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const target = await makeUser(bag);
    try {
      await fileDistinctReports(bag, target, 1, 'HARASSMENT');
      const updated = await prisma.user.findUnique({ where: { id: target.id } });
      expect(updated.banSeverity).toBe('HIGH_ALERT');
      expect(updated.banReason).toBe('HARASSMENT');
      expect(updated.bannedUntil.getUTCFullYear()).toBeGreaterThanOrEqual(9999);
    } finally {
      await cleanup(bag);
    }
  });

  test('a single qualifying SAFETY report also jumps straight to permanent', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const target = await makeUser(bag);
    try {
      await fileDistinctReports(bag, target, 1, 'SAFETY');
      const updated = await prisma.user.findUnique({ where: { id: target.id } });
      expect(updated.banSeverity).toBe('HIGH_ALERT');
    } finally {
      await cleanup(bag);
    }
  });

  test('a report older than the 90-day decay window does not count toward strikes', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const target = await makeUser(bag);
    const oldReporter = await makeUser(bag);
    await makeQualifying(oldReporter);
    const vehicle = await makeVehicle(bag, oldReporter.id);
    const trip = await makeTrip(bag, oldReporter.id, vehicle.id);
    await makeMatch(bag, trip.id, target.id);
    try {
      // Backdated report, 91 days old — Prisma honors an explicit createdAt
      // over the schema's @default(now()).
      await prisma.report.create({
        data: {
          reporterId: oldReporter.id,
          reportedUserId: target.id,
          category: 'SPAM',
          createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
        },
      });
      // A fresh, qualifying report from a SECOND reporter — if decay works,
      // this alone is only strike #1 (the old one no longer counts), not #2.
      await fileDistinctReports(bag, target, 1, 'SPAM');
      const updated = await prisma.user.findUnique({ where: { id: target.id } });
      const daysLeft = (updated.bannedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(daysLeft).toBeLessThanOrEqual(1); // 24h tier, not the 7-day tier a 2nd strike would produce
    } finally {
      await cleanup(bag);
    }
  }, 30000);
});

describe('Abuse guard — flags, does not block', () => {
  test('a 6th report from the same reporter in the window still succeeds (201) and logs a warning', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const reporter = await makeUser(bag);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (let i = 0; i < 6; i++) {
        const target = await makeUser(bag);
        const vehicle = await makeVehicle(bag, reporter.id);
        const trip = await makeTrip(bag, reporter.id, vehicle.id);
        await makeMatch(bag, trip.id, target.id);
        const res = await postReport(reporter.id, { reportedUserId: target.id, category: 'OTHER' });
        expect(res.status).toBe(201); // never blocked
      }
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('possible report abuse'));
    } finally {
      warnSpy.mockRestore();
      await cleanup(bag);
    }
  }, 30000); // 6 sequential round trips, same reasoning as the strike-ladder tests above
});

describe('A banned user is actually locked out via the auth middleware', () => {
  test('a HIGH_ALERT-banned user gets 403 ACCOUNT_SUSPENDED on their very next request', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const host = await makeUser(bag);
    const passenger = await makeUser(bag);
    await makeQualifying(passenger);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    await makeMatch(bag, trip.id, passenger.id);
    try {
      await postReport(passenger.id, { reportedUserId: host.id, category: 'SAFETY' });
      const res = await fetch(`${base}/api/trips/mine?userId=${host.id}`, { headers: bearer(host.id) });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('ACCOUNT_SUSPENDED');
      expect(body.permanent).toBe(true);
      expect(body.banReason).toBe('SAFETY');
    } finally {
      await cleanup(bag);
    }
  });
});

describe('GET /api/reports/mine — the filer\'s own report history', () => {
  async function getMine(callerId) {
    return fetch(`${base}/api/reports/mine`, { headers: bearer(callerId) });
  }

  test('a user with zero filed reports gets an empty array, not an error', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const nobody = await makeUser(bag);
    try {
      const res = await getMine(nobody.id);
      expect(res.status).toBe(200);
      expect((await res.json()).reports).toEqual([]);
    } finally {
      await cleanup(bag);
    }
  });

  test('shows a filed user-report with category, date, and the reported name — never a status/outcome field', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const host = await makeUser(bag, { fullName: 'Reported Host' });
    const passenger = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    await makeMatch(bag, trip.id, passenger.id);
    try {
      const postRes = await postReport(passenger.id, { reportedUserId: host.id, category: 'SPAM', description: 'x' });
      expect(postRes.status).toBe(201);

      const res = await getMine(passenger.id);
      expect(res.status).toBe(200);
      const { reports } = await res.json();
      expect(reports).toHaveLength(1);
      const [entry] = reports;
      expect(entry.category).toBe('SPAM');
      expect(entry.type).toBe('user');
      expect(entry.reportedUserName).toBe('Reported Host');
      expect(entry.createdAt).toBeTruthy();
      expect(entry.trip).toBeNull();
      // Never any enforcement/outcome field — the filer has no legitimate
      // reason to see whether their report "worked."
      expect(entry).not.toHaveProperty('status');
      expect(entry).not.toHaveProperty('banned');
      expect(entry).not.toHaveProperty('enforced');
      expect(entry).not.toHaveProperty('outcome');
      expect(entry).not.toHaveProperty('description'); // not asked for, keep the response minimal
    } finally {
      await cleanup(bag);
    }
  });

  test('shows a filed trip/match-issue report with the trip route attached', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const host = await makeUser(bag);
    const passenger = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, {
      originAddress: 'Sariaya',
      destinationAddress: 'Enverga University',
    });
    const match = await makeMatch(bag, trip.id, passenger.id);
    try {
      const postRes = await postReport(passenger.id, { matchId: match.id, category: 'NO_SHOW' });
      expect(postRes.status).toBe(201);

      const { reports } = await (await getMine(passenger.id)).json();
      expect(reports).toHaveLength(1);
      expect(reports[0].type).toBe('trip');
      expect(reports[0].trip).toEqual({ originAddress: 'Sariaya', destinationAddress: 'Enverga University' });
      expect(reports[0].reportedUserName).toBeTruthy(); // host's name, same convention the modal uses
    } finally {
      await cleanup(bag);
    }
  });

  test("is scoped per-reporter — a different account's history never shows someone else's report, verified via a direct API call", async () => {
    if (!dbUp) return;
    const bag = newBag();
    const host = await makeUser(bag);
    const passenger = await makeUser(bag);
    const stranger = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    await makeMatch(bag, trip.id, passenger.id);
    try {
      await postReport(passenger.id, { reportedUserId: host.id, category: 'OTHER' });

      const strangerRes = await getMine(stranger.id);
      expect(strangerRes.status).toBe(200);
      expect((await strangerRes.json()).reports).toEqual([]);

      // The reported party (host) filed nothing themselves — their own
      // history must also stay empty, not show reports made against them.
      const hostRes = await getMine(host.id);
      expect((await hostRes.json()).reports).toEqual([]);
    } finally {
      await cleanup(bag);
    }
  });

  test('no token → 401', async () => {
    if (!dbUp) return;
    const res = await fetch(`${base}/api/reports/mine`);
    expect(res.status).toBe(401);
  });
});

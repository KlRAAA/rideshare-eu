require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { decryptField } = require('../services/encryptionService');
const { setSecurityLogSink } = require('../services/securityLog');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// Women+ spec D2, D7, D8 and S17–S20, S24: changing your own gender and your
// "Trips I see" preference.

let server;
let base;
let dbUp = false;
const bag = newBag();

const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const changeGender = (user, body) => call('PATCH', '/api/users/me/gender', user.id, body);
const prefBody = (genderPreference) => ({ genderPreference, flexWindowMinutes: 15, familiarRidersOnly: false, liveLocationSharing: false });

async function womenPlusTrip(overrides = {}) {
  const host = await makeUser(bag, { fullName: 'Ana Host', gender: 'WOMAN' });
  const vehicle = await makeVehicle(bag, host.id);
  const trip = await makeTrip(bag, host.id, vehicle.id, { genderPreference: 'WOMEN_PLUS', ...overrides });
  return { host, trip };
}

const storedGender = async (id) =>
  decryptField((await prisma.user.findUnique({ where: { id }, select: { gender: true } })).gender);

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
    await prisma.notification.deleteMany({ where: { relatedTripId: { in: bag.tripIds } } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[genderChange.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('PATCH /api/users/me/gender', () => {
  test('rejects values outside the four options', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const res = await changeGender(user, { gender: 'FEMALE' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_GENDER');
  });

  test('S17/S18: pending Women+ requests are withdrawn after a warning; approved rides stay', async () => {
    if (guard()) return;
    const rider = await makeUser(bag, { fullName: 'Maria Rider', gender: 'WOMAN' });
    bag.preferenceUserIds.push(rider.id);
    await prisma.preference.create({ data: { userId: rider.id, genderPreference: 'WOMEN_PLUS' } });

    const a = await womenPlusTrip({ destinationAddress: 'Enverga University' });
    const b = await womenPlusTrip({ destinationAddress: 'Lucena Grand Terminal' });
    const approvedOn = await womenPlusTrip({ filledSeats: 1 });
    const openHost = await makeUser(bag, { gender: 'MAN' });
    const openTrip = await makeTrip(bag, openHost.id, (await makeVehicle(bag, openHost.id)).id);

    const pendingA = await makeMatch(bag, a.trip.id, rider.id);
    const pendingB = await makeMatch(bag, b.trip.id, rider.id);
    const approved = await makeMatch(bag, approvedOn.trip.id, rider.id, { status: 'APPROVED' });
    const pendingOpen = await makeMatch(bag, openTrip.id, rider.id);

    const warn = await changeGender(rider, { gender: 'MAN' });
    expect(warn.status).toBe(409);
    expect(await warn.json()).toEqual({ error: 'CONFIRM_WITHDRAW_PENDING', pendingCount: 2 });
    expect(await storedGender(rider.id)).toBe('WOMAN');

    const res = await changeGender(rider, { gender: 'MAN', confirm: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ gender: 'MAN', withdrawn: 2 });
    expect(await storedGender(rider.id)).toBe('MAN');

    const status = async (m) => (await prisma.match.findUnique({ where: { id: m.id } })).status;
    expect(await status(pendingA)).toBe('CANCELLED');
    expect(await status(pendingB)).toBe('CANCELLED');
    expect(await status(approved)).toBe('APPROVED');
    expect(await status(pendingOpen)).toBe('PENDING');

    const note = await prisma.notification.findFirst({ where: { userId: a.host.id, relatedMatchId: pendingA.id } });
    expect(note.type).toBe('CANCELLATION');
    expect(note.message).toBe('Maria Rider withdrew their request to join your trip to Enverga University.');

    expect((await prisma.preference.findUnique({ where: { userId: rider.id } })).genderPreference).toBe('ANY');
  });

  test('S19: a host with open Women+ trips must finish or cancel them first', async () => {
    if (guard()) return;
    const { host, trip } = await womenPlusTrip();
    const blocked = await changeGender(host, { gender: 'MAN', confirm: true });
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({ error: 'HOSTING_WOMEN_PLUS_TRIPS', tripCount: 1 });
    expect(await storedGender(host.id)).toBe('WOMAN');

    await prisma.trip.update({ where: { id: trip.id }, data: { status: 'CANCELLED' } });
    expect((await changeGender(host, { gender: 'MAN' })).status).toBe(200);
  });

  test('S20: a man who changes to non-binary can then join Women+ trips', async () => {
    if (guard()) return;
    const user = await makeUser(bag, { gender: 'MAN' });
    const res = await changeGender(user, { gender: 'NON_BINARY' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ gender: 'NON_BINARY', withdrawn: 0 });
    const { trip } = await womenPlusTrip();
    const join = await call('POST', '/api/matches', user.id, {
      tripId: trip.id, score: 0.9, routeOverlap: 0.9, scheduleAlignment: 0.9, preferenceMatch: true,
    });
    expect(join.status).toBe(201);
    bag.matchIds.push((await join.json()).match.id);
  });

  test('changing gender is not written to the security log', async () => {
    if (guard()) return;
    const entries = [];
    const previous = setSecurityLogSink((e) => entries.push(e));
    try {
      const user = await makeUser(bag, { gender: 'WOMAN' });
      expect((await changeGender(user, { gender: 'PREFER_NOT_TO_SAY' })).status).toBe(200);
    } finally {
      setSecurityLogSink(previous);
    }
    expect(entries).toEqual([]);
  });
});

describe('PATCH/GET /api/preferences/:userId — Trips I see', () => {
  test('only Women+ eligible users can choose Women+ trips', async () => {
    if (guard()) return;
    const man = await makeUser(bag, { gender: 'MAN' });
    const res = await call('PATCH', `/api/preferences/${man.id}`, man.id, prefBody('WOMEN_PLUS'));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('WOMEN_PLUS_NOT_ELIGIBLE');

    const woman = await makeUser(bag, { gender: 'WOMAN' });
    const ok = await call('PATCH', `/api/preferences/${woman.id}`, woman.id, prefBody('WOMEN_PLUS'));
    expect(ok.status).toBe(200);
    expect((await ok.json()).preference.genderPreference).toBe('WOMEN_PLUS');
  });

  test('S23: the retired SAME_GENDER value is rejected', async () => {
    if (guard()) return;
    const woman = await makeUser(bag, { gender: 'WOMAN' });
    const res = await call('PATCH', `/api/preferences/${woman.id}`, woman.id, prefBody('SAME_GENDER'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_PREFERENCE');
  });

  test('S24: a stored Women+ preference reads as All trips once the owner is not eligible', async () => {
    if (guard()) return;
    const user = await makeUser(bag, { gender: 'MAN' });
    await prisma.preference.create({ data: { userId: user.id, genderPreference: 'WOMEN_PLUS' } });
    const res = await call('GET', `/api/preferences/${user.id}`, user.id);
    expect((await res.json()).preference.genderPreference).toBe('ANY');
  });
});

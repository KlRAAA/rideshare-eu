require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { encryptField } = require('../services/encryptionService');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// Women+ spec §5 and S3, S4, S9, S10, S11, S22: the join endpoint and the
// host's approval enforce the trip's rule, whatever the client sends.

let server;
let base;
let dbUp = false;
const bag = newBag();

let womanHost;
let familiarHost;
let womenPlusTrip;
let familiarTrip;

const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const join = (rider, trip) =>
  call('POST', '/api/matches', rider.id, { tripId: trip.id, score: 0.9, routeOverlap: 0.9, scheduleAlignment: 0.9, preferenceMatch: true });

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  if (!dbUp) return;
  womanHost = await makeUser(bag, { fullName: 'Join W Host', gender: 'WOMAN' });
  familiarHost = await makeUser(bag, { fullName: 'Join F Host', gender: 'MAN' });
  womenPlusTrip = await makeTrip(bag, womanHost.id, (await makeVehicle(bag, womanHost.id)).id, {
    genderPreference: 'WOMEN_PLUS',
    destinationAddress: 'Enverga University',
  });
  familiarTrip = await makeTrip(bag, familiarHost.id, (await makeVehicle(bag, familiarHost.id)).id, { familiarRidersOnly: true });
});

afterAll(async () => {
  if (dbUp) {
    // A failing run can leave requests the bag never saw; clear them by trip.
    await prisma.notification.deleteMany({ where: { relatedTripId: { in: bag.tripIds } } });
    await prisma.match.deleteMany({ where: { tripId: { in: bag.tripIds } } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[womenPlusJoin.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('POST /api/matches', () => {
  test('S3: a man joining a Women+ trip gets 403 and nothing is created', async () => {
    if (guard()) return;
    const man = await makeUser(bag, { gender: 'MAN' });
    const res = await join(man, womenPlusTrip);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('TRIP_WOMEN_PLUS_ONLY');
    expect(await prisma.match.count({ where: { tripId: womenPlusTrip.id, passengerId: man.id } })).toBe(0);
  });

  test('prefer-not-to-say is refused too', async () => {
    if (guard()) return;
    const rider = await makeUser(bag, { gender: 'PREFER_NOT_TO_SAY' });
    expect((await join(rider, womenPlusTrip)).status).toBe(403);
  });

  test('S4/S9: a non-binary rider can join', async () => {
    if (guard()) return;
    const rider = await makeUser(bag, { gender: 'NON_BINARY' });
    const res = await join(rider, womenPlusTrip);
    expect(res.status).toBe(201);
    bag.matchIds.push((await res.json()).match.id);
  });

  test('S10: a stranger joining a familiar-riders-only trip gets 403', async () => {
    if (guard()) return;
    const stranger = await makeUser(bag, { gender: 'WOMAN' });
    const res = await join(stranger, familiarTrip);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('TRIP_FAMILIAR_RIDERS_ONLY');
  });

  test('S11: a rider who completed a ride with that host can join', async () => {
    if (guard()) return;
    const rider = await makeUser(bag, { gender: 'MAN' });
    const earlier = await makeTrip(bag, familiarHost.id, familiarTrip.vehicleId, { status: 'COMPLETED' });
    await makeMatch(bag, earlier.id, rider.id, { status: 'COMPLETED' });
    const res = await join(rider, familiarTrip);
    expect(res.status).toBe(201);
    bag.matchIds.push((await res.json()).match.id);
  });
});

describe('PATCH /api/matches/:id (approve)', () => {
  test('S22: a rider who became ineligible before approval is declined with 409', async () => {
    if (guard()) return;
    const rider = await makeUser(bag, { gender: 'WOMAN' });
    const res = await join(rider, womenPlusTrip);
    expect(res.status).toBe(201);
    const { match } = await res.json();
    bag.matchIds.push(match.id);

    await prisma.user.update({ where: { id: rider.id }, data: { gender: encryptField('MAN') } });
    const before = await prisma.trip.findUnique({ where: { id: womenPlusTrip.id }, select: { filledSeats: true } });

    const approve = await call('PATCH', `/api/matches/${match.id}`, womanHost.id, { status: 'APPROVED' });
    expect(approve.status).toBe(409);
    expect((await approve.json()).error).toBe('RIDER_NO_LONGER_ELIGIBLE');

    expect((await prisma.match.findUnique({ where: { id: match.id } })).status).toBe('DECLINED');
    const after = await prisma.trip.findUnique({ where: { id: womenPlusTrip.id }, select: { filledSeats: true } });
    expect(after.filledSeats).toBe(before.filledSeats);
    const note = await prisma.notification.findFirst({ where: { userId: rider.id, relatedMatchId: match.id } });
    expect(note.type).toBe('APPROVAL');
    expect(note.message).toBe('Your request to join the trip to Enverga University was declined.');
  });

  test('an eligible rider is approved as before', async () => {
    if (guard()) return;
    const rider = await makeUser(bag, { gender: 'WOMAN' });
    const { match } = await (await join(rider, womenPlusTrip)).json();
    bag.matchIds.push(match.id);
    const approve = await call('PATCH', `/api/matches/${match.id}`, womanHost.id, { status: 'APPROVED' });
    expect(approve.status).toBe(200);
  });
});

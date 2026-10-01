require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { decryptField } = require('../services/encryptionService');
const { newBag, makeUser, makeAdminUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

let server;
let base;
let dbUp = false;
const bag = newBag();
const PASSWORD = 'Delete-Me-2026';

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
const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? bearer(userId) : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

async function withPassword(user) {
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(PASSWORD, 4) } });
  return user;
}

describe('DELETE /api/users/me', () => {
  test('a wrong password changes nothing', async () => {
    if (guard()) return;
    const user = await withPassword(await makeUser(bag, { fullName: 'Keep Me' }));
    const res = await call('DELETE', '/api/users/me', user.id, { password: 'wrong' });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('INVALID_PASSWORD');
    const saved = await prisma.user.findUnique({ where: { id: user.id } });
    expect(saved.deletedAt).toBeNull();
    expect(decryptField(saved.fullName)).toBe('Keep Me');
  });

  test('anonymizes the account, cancels its rides, and keeps other people’s records', async () => {
    if (guard()) return;
    const leaving = await withPassword(await makeUser(bag, { fullName: 'Leaving User' }));
    const passenger = await makeUser(bag);
    const otherHost = await makeUser(bag);

    // Leaving user hosts an open trip with an approved passenger.
    const car = await makeVehicle(bag, leaving.id);
    await prisma.vehicle.update({ where: { id: car.id }, data: { plate: 'DEL 123' } });
    const hosted = await makeTrip(bag, leaving.id, car.id, { filledSeats: 1, driverNotes: 'Gate 2' });
    const hostedMatch = await makeMatch(bag, hosted.id, passenger.id, { status: 'APPROVED' });

    // Leaving user also holds a seat on someone else's full trip.
    const otherCar = await makeVehicle(bag, otherHost.id);
    const joined = await makeTrip(bag, otherHost.id, otherCar.id, { totalSeats: 1, filledSeats: 1, status: 'FULL' });
    const joinedMatch = await makeMatch(bag, joined.id, leaving.id, { status: 'APPROVED' });

    // Personal extras that must disappear.
    await prisma.preference.create({ data: { userId: leaving.id } });
    await prisma.savedVehicle.create({
      data: { ownerId: leaving.id, make: 'Toyota', model: 'Vios', color: 'White', fuelEfficiencyKmL: 14, isDefault: true },
    });
    await prisma.message.create({ data: { tripId: hosted.id, senderId: leaving.id, body: 'See you at the gate' } });

    // A rating the leaving user gave, which must survive (it shaped someone's trust score).
    await prisma.match.update({ where: { id: joinedMatch.id }, data: { status: 'COMPLETED' } });
    const rating = await prisma.rating.create({
      data: { matchId: joinedMatch.id, raterId: leaving.id, rateeId: otherHost.id, score: 5, occurrenceDate: new Date('2026-09-01T00:00:00Z') },
    });
    await prisma.match.update({ where: { id: joinedMatch.id }, data: { status: 'APPROVED' } });

    const res = await call('DELETE', '/api/users/me', leaving.id, { password: PASSWORD });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ACCOUNT_DELETED' });

    const user = await prisma.user.findUnique({ where: { id: leaving.id } });
    expect(user.deletedAt).not.toBeNull();
    expect(decryptField(user.fullName)).toBe('Deleted user');
    expect(user.email).toBe(`deleted-${leaving.id}@deleted.invalid`);
    expect(user.universityId).toBe(`deleted-${leaving.id}`);
    expect(user.avatarUrl).toBeNull();
    expect(await bcrypt.compare(PASSWORD, user.passwordHash)).toBe(false);

    expect(await prisma.preference.count({ where: { userId: leaving.id } })).toBe(0);
    expect(await prisma.savedVehicle.count({ where: { ownerId: leaving.id } })).toBe(0);
    expect(await prisma.message.count({ where: { senderId: leaving.id } })).toBe(0);
    expect((await prisma.vehicle.findUnique({ where: { id: car.id } })).plate).toBeNull();

    const hostedAfter = await prisma.trip.findUnique({ where: { id: hosted.id } });
    expect(hostedAfter.status).toBe('CANCELLED');
    expect(decryptField(hostedAfter.originAddress)).toBe('Removed');
    expect(hostedAfter.originLat).toBe(hostedAfter.destinationLat);
    expect(hostedAfter.driverNotes).toBeNull();
    expect((await prisma.match.findUnique({ where: { id: hostedMatch.id } })).status).toBe('CANCELLED');
    expect(await prisma.notification.count({ where: { userId: passenger.id, relatedTripId: hosted.id, type: 'CANCELLATION' } })).toBe(1);

    const joinedAfter = await prisma.trip.findUnique({ where: { id: joined.id } });
    expect(joinedAfter).toMatchObject({ filledSeats: 0, status: 'OPEN' });
    expect(await prisma.notification.count({ where: { userId: otherHost.id, relatedTripId: joined.id, type: 'CANCELLATION' } })).toBe(1);

    expect(await prisma.rating.findUnique({ where: { id: rating.id } })).not.toBeNull();

    const reused = await call('GET', '/api/trips/mine', leaving.id);
    expect(reused.status).toBe(401);
    expect((await reused.json()).error).toBe('ACCOUNT_DELETED');
  });

  test('the only admin must promote someone else first; an admin among several is demoted on deletion', async () => {
    if (guard()) return;
    const admins = await prisma.user.count({ where: { isAdmin: true, deletedAt: null } });
    const first = await withPassword(await makeAdminUser(bag));
    if (admins === 0) {
      const blocked = await call('DELETE', '/api/users/me', first.id, { password: PASSWORD });
      expect(blocked.status).toBe(409);
      expect((await blocked.json()).error).toBe('LAST_ADMIN');
    }
    await makeAdminUser(bag);
    const res = await call('DELETE', '/api/users/me', first.id, { password: PASSWORD });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: first.id } })).isAdmin).toBe(false);
  });

  test('requires a password', async () => {
    if (guard()) return;
    const user = await withPassword(await makeUser(bag));
    const res = await call('DELETE', '/api/users/me', user.id, {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('PASSWORD_REQUIRED');
  });
});

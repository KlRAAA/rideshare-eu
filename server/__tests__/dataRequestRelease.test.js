require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { encryptField } = require('../services/encryptionService');
const { buildRelease } = require('../services/dataRequestService');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// Superadmin spec §5 and S1, S4, S8, S9: a release holds exactly what the
// request covers and nothing that identifies other people beyond their names.

let dbUp = false;
const bag = newBag();
const ids = {};

const PH = (iso) => new Date(iso);
const SEPTEMBER = { fromDate: PH('2026-09-01T00:00:00+08:00'), toDate: PH('2026-09-30T23:59:59.999+08:00') };
const baseRequest = () => ({
  id: 'req-1',
  subjectUserId: ids.subject,
  agency: 'PNP Lucena',
  officerName: 'PCPT Cruz',
  referenceNumber: 'BLT-1',
  legalBasis: 'WARRANT',
  ...SEPTEMBER,
  includeChats: true,
  includeSupport: true,
});

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    return;
  }
  const subject = await makeUser(bag, { fullName: 'Maria Subject' });
  const host = await makeUser(bag, { fullName: 'Host Name' });
  const coRider = await makeUser(bag, { fullName: 'Co Rider' });
  const outsider = await makeUser(bag, { fullName: 'Declined Outsider' });
  Object.assign(ids, { subject: subject.id, host: host.id, coRider: coRider.id, coRiderUniversityId: coRider.universityId });

  const hostCar = await makeVehicle(bag, host.id);
  await prisma.vehicle.update({ where: { id: hostCar.id }, data: { plate: 'ABC 1234' } });
  const subjectCar = await makeVehicle(bag, subject.id);

  const tripA = await makeTrip(bag, host.id, hostCar.id, {
    departureTime: PH('2026-09-10T07:00:00+08:00'),
    status: 'COMPLETED',
    originAddress: 'Sariaya Plaza',
  });
  await makeMatch(bag, tripA.id, subject.id, { status: 'COMPLETED' });
  await makeMatch(bag, tripA.id, coRider.id, { status: 'COMPLETED' });
  await makeMatch(bag, tripA.id, outsider.id, { status: 'DECLINED' });
  const message = await prisma.message.create({ data: { tripId: tripA.id, senderId: subject.id, body: 'See you at the plaza' } });

  const tripB = await makeTrip(bag, host.id, hostCar.id, { departureTime: PH('2026-11-20T07:00:00+08:00') });
  await makeMatch(bag, tripB.id, subject.id, { status: 'APPROVED' });

  const tripC = await makeTrip(bag, subject.id, subjectCar.id, {
    departureTime: PH('2026-08-01T06:30:00+08:00'),
    recurrenceType: 'DAILY',
  });

  const tripD = await makeTrip(bag, host.id, hostCar.id, { departureTime: PH('2026-09-12T07:00:00+08:00') });
  await makeMatch(bag, tripD.id, coRider.id, { status: 'COMPLETED' });

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: subject.id,
      category: 'SAFETY',
      subject: 'Driver was speeding',
      messages: { create: { authorId: subject.id, fromAdmin: false, body: 'On the highway this morning.' } },
    },
  });
  Object.assign(ids, { tripA: tripA.id, tripB: tripB.id, tripC: tripC.id, tripD: tripD.id, message: message.id, ticket: ticket.id });
});

afterAll(async () => {
  if (dbUp) {
    await prisma.message.deleteMany({ where: { tripId: { in: bag.tripIds } } });
    await prisma.supportTicket.deleteMany({ where: { userId: { in: bag.userIds } } });
    await cleanup(bag);
  }
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[dataRequestRelease.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

const tripFor = (release, origin) => release.trips.find((t) => t.origin === origin);

describe('normal release', () => {
  test('S1: trips in the range, recurring trips still running, chats and support when named', async () => {
    if (guard()) return;
    const release = await buildRelease(prisma, baseRequest(), PH('2026-10-05T00:00:00Z'));

    expect(release.subject).toMatchObject({ name: 'Maria Subject', deleted: false });
    expect(release.trips).toHaveLength(2); // A and C; not B (November) and not D (subject not on it)

    const a = tripFor(release, 'Sariaya Plaza');
    expect(a).toMatchObject({
      subjectRole: 'PASSENGER',
      subjectRequestStatus: 'COMPLETED',
      driver: 'Host Name',
      coRiders: ['Co Rider'],
      car: expect.objectContaining({ plate: 'ABC 1234' }),
      status: 'COMPLETED',
    });
    expect(a.messages).toEqual([expect.objectContaining({ sender: 'Maria Subject', body: 'See you at the plaza' })]);

    const c = release.trips.find((t) => t.recurrenceType === 'DAILY');
    expect(c).toMatchObject({ subjectRole: 'DRIVER', subjectRequestStatus: null, driver: 'Maria Subject' });

    expect(release.supportRequests).toEqual([
      expect.objectContaining({
        subject: 'Driver was speeding',
        messages: [expect.objectContaining({ from: 'User', body: 'On the highway this morning.' })],
      }),
    ]);
  });

  test('S9: no emails, no co-rider university IDs, no declined outsiders', async () => {
    if (guard()) return;
    const text = JSON.stringify(await buildRelease(prisma, baseRequest()));
    expect(text).not.toContain('@test.local');
    expect(text).not.toContain(ids.coRiderUniversityId);
    expect(text).not.toContain('Declined Outsider');
    expect(text).not.toContain('passwordHash');
  });

  test('chats and support are left out unless the request names them', async () => {
    if (guard()) return;
    const release = await buildRelease(prisma, { ...baseRequest(), includeChats: false, includeSupport: false });
    expect(release.trips.every((t) => t.messages === null)).toBe(true);
    expect(release.supportRequests).toBeNull();
  });
});

describe('emergency release', () => {
  test('S4: the most recent trip, the next 24 hours and the regular commute; never chats', async () => {
    if (guard()) return;
    const release = await buildRelease(
      prisma,
      { ...baseRequest(), legalBasis: 'EMERGENCY', fromDate: null, toDate: null },
      PH('2026-09-10T12:00:00+08:00')
    );
    const origins = release.trips.map((t) => t.recurrenceType === 'DAILY' ? 'C' : t.origin);
    expect(origins).toEqual(['C', 'Sariaya Plaza']); // sorted by first departure
    expect(release.trips.every((t) => t.messages === null)).toBe(true);
    expect(release.supportRequests).toBeNull();
    expect(release.request.includeChats).toBe(false);
  });
});

describe('deleted account', () => {
  test('S8: says the account was deleted', async () => {
    if (guard()) return;
    const ghost = await makeUser(bag, { fullName: 'Gone User' });
    await prisma.user.update({ where: { id: ghost.id }, data: { deletedAt: new Date(), fullName: encryptField('Deleted user') } });
    const release = await buildRelease(prisma, { ...baseRequest(), subjectUserId: ghost.id });
    expect(release.subject).toMatchObject({ name: 'Deleted user', deleted: true });
    expect(release.trips).toEqual([]);
  });
});

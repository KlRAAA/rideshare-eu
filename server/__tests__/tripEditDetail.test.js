require('dotenv').config({ quiet: true }); // jest doesn't load .env the way server.js does
const app = require('../app');
const prisma = require('../config/db');
const { computeFuelSharePerSeat } = require('../services/fuelShareService');
const { bearer } = require('../test-helpers/auth'); // API now requires a session token
const { encryptField } = require('../services/encryptionService');

// Regression for: "trip shows in My Trips list but View Details 404s."
// Root cause was a flaky dev DB connection surfacing as a 500 that the frontend
// mapped to notFound(); the checks below prove the edit path itself never
// leaves a trip that GET /api/trips/:id can't return. Skips (not fails) when no
// database is reachable, so `npm test` stays green offline.

let server;
let base;
let dbUp = false;

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch (e) {
    console.warn('[tripEditDetail.test] no database reachable — skipping integration assertions:', e.code || e.message);
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

describe('edit a trip, then open its detail page', () => {
  test('a trip edited via PATCH still resolves on GET /api/trips/:id — never a 404', async () => {
    if (!dbUp) {
      console.warn('[tripEditDetail.test] DB unavailable — regression assertion not exercised this run');
      return;
    }
    const host = await prisma.user.findFirst();
    const vehicle = await prisma.vehicle.create({
      data: { ownerId: host.id, make: 'Reg', model: 'Test', color: 'White', fuelEfficiencyKmL: 12 },
    });
    const trip = await prisma.trip.create({
      data: {
        hostId: host.id,
        vehicleId: vehicle.id,
        originAddress: encryptField('Origin'),
        originLat: 13.9,
        originLng: 121.5,
        destinationAddress: encryptField('MSEUF'),
        destinationLat: 13.95,
        destinationLng: 121.62,
        distanceMeters: 20000,
        durationSeconds: 1800,
        departureTime: new Date(Date.now() + 2 * 86400000),
        recurrenceType: 'ONE_TIME',
        customDays: [],
        totalSeats: 3,
        genderPreference: 'ANY',
        flexibleDeparture: false,
        flexWindowMinutes: 15,
        familiarRidersOnly: false,
        fuelSharePerSeat: computeFuelSharePerSeat({
          distanceMeters: 20000,
          efficiencyKmL: 12,
          pricePerLiter: 62.55,
          passengerSeats: 3,
        }),
      },
    });

    const patch = (body) =>
      fetch(`${base}/api/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...bearer(host.id) },
        body: JSON.stringify({ userId: host.id, ...body }),
      });

    try {
      expect((await patch({ driverNotes: 'edited via regression test' })).status).toBe(200); // cosmetic
      expect((await patch({ totalSeats: 4 })).status).toBe(200); // structural, 0 approved

      const detail = await fetch(`${base}/api/trips/${trip.id}?userId=${host.id}`, { headers: bearer(host.id) });
      expect(detail.status).not.toBe(404);
      expect(detail.status).toBe(200);

      const { trip: got } = await detail.json();
      expect(got.id).toBe(trip.id);
      expect(got.driverNotes).toBe('edited via regression test');
      expect(got.totalSeats).toBe(4);
      expect(got.host).toBeTruthy();
      expect(Array.isArray(got.matches)).toBe(true);
    } finally {
      await prisma.notification.deleteMany({ where: { relatedTripId: trip.id } });
      await prisma.match.deleteMany({ where: { tripId: trip.id } });
      await prisma.trip.delete({ where: { id: trip.id } });
      await prisma.vehicle.delete({ where: { id: vehicle.id } });
    }
  });
});

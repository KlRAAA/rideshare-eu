// Load test data (sub-project J): accounts and trips around Lucena in a
// separate database (500 accounts by default; LOAD_USERS=1500 for more).
// Refuses to run against anything but rideshare_load.
//
//   DATABASE_URL=postgres://postgres:postgres@localhost:5432/rideshare_load node loadtest/seed.cjs
//
// Writes loadtest/fixture.json: who drives which running trip, who rides it,
// and who just browses, for run.cjs.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');

if (!/\/rideshare_load(\?|$)/.test(process.env.DATABASE_URL || '')) {
  console.error('DATABASE_URL must point at the rideshare_load database.');
  process.exit(1);
}
const prisma = require('../server/config/db');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch } = require('../server/test-helpers/seed');
const { phDateOnly } = require('../server/services/recurrenceMath');

const USERS = Number(process.env.LOAD_USERS || 500);
const DRIVERS = Math.round(USERS * 0.12);
const PASSENGERS = USERS - DRIVERS;
const RUNNING = Math.round(USERS * 0.08); // trips on the road right now, 3 riders each
const MSEUF = { lat: 13.9490188, lng: 121.6202904 };
// Towns riders commute from, towards campus.
const TOWNS = [
  { lat: 13.9629837, lng: 121.5243402 }, // Sariaya
  { lat: 14.0257, lng: 121.5925 }, // Tayabas
  { lat: 13.9311, lng: 121.4233 }, // Candelaria
  { lat: 13.9389, lng: 121.6714 }, // Pagbilao road
];
const MIN = 60 * 1000;

const inBatches = async (n, size, make) => {
  const out = [];
  for (let i = 0; i < n; i += size) {
    out.push(...(await Promise.all(Array.from({ length: Math.min(size, n - i) }, (_, k) => make(i + k)))));
  }
  return out;
};

(async () => {
  const bag = newBag();
  const drivers = await inBatches(DRIVERS, 20, (i) => makeUser(bag, { fullName: `Load Driver ${i}` }));
  const passengers = await inBatches(PASSENGERS, 20, (i) =>
    makeUser(bag, { fullName: `Load Rider ${i}`, gender: i % 2 ? 'WOMAN' : 'MAN', licensed: false })
  );

  const now = Date.now();
  const trips = await inBatches(DRIVERS, 10, async (i) => {
    const from = TOWNS[i % TOWNS.length];
    const vehicle = await makeVehicle(bag, drivers[i].id);
    const running = i < RUNNING;
    return makeTrip(bag, drivers[i].id, vehicle.id, {
      originAddress: 'Load test origin',
      originLat: from.lat,
      originLng: from.lng,
      destinationLat: MSEUF.lat,
      destinationLng: MSEUF.lng,
      routeWaypoints: [from, { lat: (from.lat + MSEUF.lat) / 2, lng: (from.lng + MSEUF.lng) / 2 }, MSEUF],
      distanceMeters: 15000,
      durationSeconds: 1500,
      // Running trips left 5 minutes ago; the rest leave later today, so search finds them.
      departureTime: new Date(running ? now - 5 * MIN : now + (60 + i * 3) * MIN),
      recurrenceType: i % 3 === 0 ? 'WEEKDAYS' : 'ONE_TIME',
      totalSeats: 4,
      filledSeats: running ? 3 : 0,
      flexibleDeparture: true,
      flexWindowMinutes: 30,
    });
  });

  const live = [];
  for (let i = 0; i < RUNNING; i++) {
    const trip = trips[i];
    const riders = passengers.slice(i * 3, i * 3 + 3);
    await Promise.all(riders.map((r) => makeMatch(bag, trip.id, r.id, { status: 'APPROVED' })));
    const departed = new Date(now - 5 * MIN);
    await prisma.tripRun.create({
      data: { tripId: trip.id, runDate: phDateOnly(departed), status: 'ONGOING', startedAt: departed, plannedArrivalAt: new Date(now + 20 * MIN) },
    });
    live.push({ tripId: trip.id, driverId: trip.hostId, riderIds: riders.map((r) => r.id), origin: TOWNS[i % TOWNS.length] });
  }

  // A few alerts each, so the feed and the Alerts list return real rows.
  await prisma.notification.createMany({
    data: [...drivers, ...passengers].flatMap((u) =>
      Array.from({ length: 5 }, (_, k) => ({ userId: u.id, type: 'REMINDER', message: `Load test alert ${k}` }))
    ),
  });

  const browsers = passengers.slice(RUNNING * 3).map((p) => p.id);
  const idleDrivers = drivers.slice(RUNNING).map((d) => d.id);
  fs.writeFileSync(path.join(__dirname, 'fixture.json'), JSON.stringify({ live, browsers, idleDrivers, towns: TOWNS, campus: MSEUF }, null, 2));
  console.log(`Seeded ${drivers.length} drivers, ${passengers.length} passengers, ${trips.length} trips (${RUNNING} running).`);
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

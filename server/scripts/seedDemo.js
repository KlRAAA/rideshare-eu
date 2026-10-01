// Fills a separate demo database with placeholder people and rides, for
// screenshots and live demos. Every name, email, ID and plate here is made up.
//
//   DATABASE_URL=postgres://postgres:postgres@localhost:5432/rideshare_demo npm run seed:demo
//
// Refuses to run unless the database name contains "demo", because it wipes
// every table first. Rides, join requests, chat, completions and ratings go
// through the real API (in-process, like the integration tests), so scores,
// fuel shares and notifications are computed by the app itself.
//
// Every demo account signs in with DEMO_PASSWORD below.

require('dotenv').config({ quiet: true });
// Never email anyone from demo data (placeholder addresses on a real domain).
process.env.SMTP_HOST = '';
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { encryptField } = require('../services/encryptionService');

const DEMO_PASSWORD = 'Demo-Ride-2026';
const CAMPUS = { lat: 13.9490188, lng: 121.6202904, address: 'Manuel S. Enverga University Foundation, Lucena City' };
const FUEL_PRICE = 64.5; // official cap set by the demo admin
const TRIP_FUEL_PRICE = 62.75;

const PLACES = {
  sariayaPlaza: { lat: 13.9629837, lng: 121.5243402, address: 'Sariaya Town Plaza, Sariaya, Quezon' },
  sariayaEast: { lat: 13.9661, lng: 121.5402, address: 'Brgy. Castañas, Sariaya, Quezon' },
  mariaHome: { lat: 13.9647, lng: 121.5301 },
  tayabas: { lat: 14.0263, lng: 121.5926, address: 'Tayabas Basilica, Tayabas City' },
  lucban: { lat: 14.1134, lng: 121.5566, address: 'Lucban Town Plaza, Lucban, Quezon' },
};

const PEOPLE = {
  juan: { fullName: 'Juan Dela Cruz', gender: 'MALE', role: 'STUDENT', universityId: '2023-10001' },
  maria: { fullName: 'Maria Santos', gender: 'FEMALE', role: 'STUDENT', universityId: '2023-10002' },
  ana: { fullName: 'Ana Reyes', gender: 'FEMALE', role: 'STUDENT', universityId: '2022-10003' },
  carlo: { fullName: 'Carlo Mendoza', gender: 'MALE', role: 'FACULTY', universityId: 'FAC-10004' },
  miguel: { fullName: 'Miguel Torres', gender: 'MALE', role: 'STUDENT', universityId: '2024-10005' },
  bea: { fullName: 'Bea Villanueva', gender: 'FEMALE', role: 'STUDENT', universityId: '2024-10006' },
  paolo: { fullName: 'Paolo Garcia', gender: 'MALE', role: 'STUDENT', universityId: '2023-10007' },
  rico: { fullName: 'Rico Bautista', gender: 'MALE', role: 'STUDENT', universityId: '2025-10008' },
  liza: { fullName: 'Liza Ramos', gender: 'FEMALE', role: 'FACULTY', universityId: 'FAC-10009', isAdmin: true },
};

const emailFor = (key) =>
  `demo.${key}@${PEOPLE[key].role === 'FACULTY' ? 'mseuf.edu.ph' : 'student.mseuf.edu.ph'}`;

function assertDemoDatabase() {
  const url = process.env.DATABASE_URL || '';
  const name = url.split('/').pop().split('?')[0];
  if (!name.includes('demo')) {
    throw new Error(`Refusing to seed "${name}": this script wipes every table, so the database name must contain "demo".`);
  }
}

async function wipe() {
  // Children before parents.
  await prisma.rating.deleteMany();
  await prisma.report.deleteMany();
  await prisma.message.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.match.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.savedVehicle.deleteMany();
  await prisma.preference.deleteMany();
  await prisma.adminAction.deleteMany();
  await prisma.fuelPrice.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.user.deleteMany();
}

async function createUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = {};
  for (const [key, p] of Object.entries(PEOPLE)) {
    const user = await prisma.user.create({
      data: {
        email: emailFor(key),
        passwordHash,
        fullName: encryptField(p.fullName),
        gender: encryptField(p.gender),
        role: p.role,
        universityId: p.universityId,
        verified: true,
        hasSeenOnboarding: true,
        isAdmin: Boolean(p.isAdmin),
        termsAcceptedAt: new Date(),
        termsVersion: '2026-09-17',
      },
    });
    users[key] = user;
  }
  return users;
}

// In-process API client, same pattern as the integration tests.
function apiClient(base) {
  return async function api(userId, method, path, body) {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
    return json;
  };
}

// Road geometry from Mapbox, exactly what the post form would send. Falls back
// to no route (the app then uses a straight line) if there's no token.
async function directions(from, to) {
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return {};
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}`
    + `?geometries=geojson&overview=full&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) return {};
  const route = (await res.json()).routes?.[0];
  if (!route) return {};
  return {
    routeWaypoints: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceMeters: Math.round(route.distance),
    durationSeconds: Math.round(route.duration),
  };
}

// Next weekday at hh:mm Philippine time (UTC+8).
function nextWeekdayAt(hhmm, from = new Date()) {
  const day = new Date(from);
  do {
    day.setUTCDate(day.getUTCDate() + 1);
  } while ([0, 6].includes(new Date(`${phDate(day)}T12:00:00+08:00`).getUTCDay()));
  return new Date(`${phDate(day)}T${hhmm}:00+08:00`);
}

function phDate(d) {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function daysAgoAt(days, hhmm) {
  const d = new Date(Date.now() - days * 86400 * 1000);
  return new Date(`${phDate(d)}T${hhmm}:00+08:00`);
}

async function postTrip(api, hostId, vehicleId, { from, to, departureTime, ...rest }) {
  const route = await directions(from, to);
  const { trip } = await api(hostId, 'POST', '/api/trips', {
    vehicleId,
    originAddress: from.address,
    originLat: from.lat,
    originLng: from.lng,
    destinationAddress: to.address,
    destinationLat: to.lat,
    destinationLng: to.lng,
    departureTime: departureTime.toISOString(),
    recurrenceType: 'ONE_TIME',
    customDays: [],
    totalSeats: 3,
    genderPreference: 'ANY',
    flexibleDeparture: true,
    flexWindowMinutes: 15,
    familiarRidersOnly: false,
    fuelPricePerLiter: TRIP_FUEL_PRICE,
    ...route,
    ...rest,
  });
  return trip;
}

// Search as the passenger would, then join with the scores the search returned.
// The app sends departureMinutes as UTC minutes after midnight (see
// phTimeToUtcMinutes in src/lib/format.ts); wantOffset is how many minutes
// off the trip's own time the passenger's preferred departure is.
async function join(api, passengerId, trip, { from, message, wantOffset = 0 }) {
  const departure = new Date(trip.departureTime);
  const departureMinutes = (departure.getUTCHours() * 60 + departure.getUTCMinutes() + wantOffset + 1440) % 1440;
  const { matches } = await api(passengerId, 'POST', '/api/matches/search', {
    origin: { lat: from.lat, lng: from.lng },
    destination: { lat: CAMPUS.lat, lng: CAMPUS.lng },
    departureMinutes,
    date: phDate(departure),
    flexWindowMinutes: 15,
    genderPreference: 'ANY',
  });
  let m = matches.find((x) => x.tripId === trip.id);
  if (!m) {
    // Trips heading away from campus don't show in a campus-bound search;
    // score them through the same show-all path the app falls back to.
    const fallback = await api(passengerId, 'POST', '/api/matches/show-all', {
      origin: { lat: from.lat, lng: from.lng },
      destination: { lat: trip.destinationLat, lng: trip.destinationLng },
      departureMinutes,
      date: phDate(departure),
      flexWindowMinutes: 15,
      genderPreference: 'ANY',
    });
    m = fallback.matches.find((x) => x.tripId === trip.id);
  }
  if (!m) throw new Error(`trip ${trip.id} not found in search for passenger ${passengerId}`);
  const { match } = await api(passengerId, 'POST', '/api/matches', {
    tripId: trip.id,
    score: m.score,
    routeOverlap: m.routeOverlap,
    scheduleAlignment: m.scheduleAlignment,
    preferenceMatch: m.preferenceMatch,
    message,
  });
  return match;
}

// A finished ride from earlier in the week, rated by both sides.
async function pastRide(api, { hostId, vehicleId, from, daysAgo, riders }) {
  const trip = await postTrip(api, hostId, vehicleId, { from, to: CAMPUS, departureTime: nextWeekdayAt('06:45') });
  const matches = [];
  for (const r of riders) {
    const match = await join(api, r.user.id, trip, { from: r.from, message: r.message, wantOffset: r.wantOffset });
    await api(hostId, 'PATCH', `/api/matches/${match.id}`, { status: 'APPROVED' });
    matches.push({ ...r, match });
  }
  await prisma.trip.update({ where: { id: trip.id }, data: { departureTime: daysAgoAt(daysAgo, '06:45') } });
  await api(hostId, 'POST', `/api/trips/${trip.id}/complete`);
  for (const r of matches) {
    await api(r.user.id, 'POST', `/api/matches/${r.match.id}/ratings`, {
      rateeId: hostId, score: r.stars, comment: r.comment, anonymous: Boolean(r.anonymous),
    });
    await api(hostId, 'POST', `/api/matches/${r.match.id}/ratings`, { rateeId: r.user.id, score: 5 });
  }
  return trip;
}

async function main() {
  assertDemoDatabase();
  const app = require('../app');
  const server = app.listen(0);
  const api = apiClient(`http://127.0.0.1:${server.address().port}`);

  try {
    await wipe();
    const u = await createUsers();

    await api(u.liza.id, 'PUT', '/api/admin/fuel-price', { pricePerLiter: FUEL_PRICE });

    const cars = {
      juan: { make: 'Toyota', model: 'Vios', color: 'Silver', plate: 'DMO 1001', fuelEfficiencyKmL: 14 },
      ana: { make: 'Honda', model: 'City', color: 'Pearl White', plate: 'DMO 1002', fuelEfficiencyKmL: 15 },
      carlo: { make: 'Mitsubishi', model: 'Xpander', color: 'Graphite Gray', plate: 'DMO 1003', fuelEfficiencyKmL: 11 },
      miguel: { make: 'Suzuki', model: 'Dzire', color: 'Red', plate: 'DMO 1004', fuelEfficiencyKmL: 18 },
    };
    const vehicleIds = {};
    for (const [key, car] of Object.entries(cars)) {
      await api(u[key].id, 'POST', '/api/saved-vehicles', car);
      vehicleIds[key] = (await api(u[key].id, 'POST', '/api/vehicles', car)).vehicle.id;
    }
    await api(u.juan.id, 'POST', '/api/saved-vehicles', {
      make: 'Honda', model: 'Click 125', color: 'Black', plate: 'DMO 2001', fuelEfficiencyKmL: 45,
    });
    await api(u.ana.id, 'PATCH', `/api/preferences/${u.ana.id}`, {
      genderPreference: 'SAME_GENDER', flexWindowMinutes: 15, familiarRidersOnly: false, liveLocationSharing: true,
    });
    await api(u.juan.id, 'PATCH', `/api/preferences/${u.juan.id}`, {
      genderPreference: 'ANY', flexWindowMinutes: 15, familiarRidersOnly: false, liveLocationSharing: true,
    });

    // Last week's rides, so profiles carry trust scores and reviews.
    await pastRide(api, {
      hostId: u.juan.id, vehicleId: vehicleIds.juan, from: PLACES.sariayaPlaza, daysAgo: 3,
      riders: [
        { user: u.maria, from: PLACES.mariaHome, wantOffset: -5, stars: 5, comment: 'Right on time and drove carefully. Will ride again!', message: 'Hi! Can I join you?' },
        { user: u.paolo, from: PLACES.sariayaPlaza, wantOffset: 8, stars: 4, comment: 'Smooth ride, friendly driver.', message: 'Sakay po ako sa plaza.' },
      ],
    });
    await pastRide(api, {
      hostId: u.juan.id, vehicleId: vehicleIds.juan, from: PLACES.sariayaPlaza, daysAgo: 2,
      riders: [{ user: u.bea, from: PLACES.sariayaEast, stars: 5, comment: 'Very accommodating, waited for me at the corner.', anonymous: true, message: 'Hello po!' }],
    });
    await pastRide(api, {
      hostId: u.ana.id, vehicleId: vehicleIds.ana, from: PLACES.tayabas, daysAgo: 2,
      riders: [{ user: u.bea, from: PLACES.tayabas, stars: 5, comment: 'Clean car and great music.', message: 'Hi Ate Ana!' }],
    });

    // Tomorrow morning's rides into campus.
    const juanTrip = await postTrip(api, u.juan.id, vehicleIds.juan, {
      from: PLACES.sariayaPlaza, to: CAMPUS, departureTime: nextWeekdayAt('06:45'),
      recurrenceType: 'WEEKDAYS', totalSeats: 3,
      driverNotes: 'Leaving from the plaza in front of the church. Aircon, no smoking.',
      meetingPointAddress: 'Sariaya Town Plaza (church side)', meetingPointLat: 13.9632, meetingPointLng: 121.5249,
    });
    await postTrip(api, u.miguel.id, vehicleIds.miguel, {
      from: PLACES.sariayaEast, to: CAMPUS, departureTime: nextWeekdayAt('07:00'), totalSeats: 2,
      driverNotes: 'Passing by the highway, can pick up along the way.',
    });
    const anaTrip = await postTrip(api, u.ana.id, vehicleIds.ana, {
      from: PLACES.tayabas, to: CAMPUS, departureTime: nextWeekdayAt('06:50'), genderPreference: 'SAME_GENDER', totalSeats: 3,
      driverNotes: 'Female riders only. Meet at the basilica parking.',
    });
    await postTrip(api, u.carlo.id, vehicleIds.carlo, {
      from: PLACES.lucban, to: CAMPUS, departureTime: nextWeekdayAt('06:15'), recurrenceType: 'WEEKDAYS', totalSeats: 4,
      driverNotes: 'Faculty commute, MWF and TTh. Students welcome.',
    });
    const homeTrip = await postTrip(api, u.juan.id, vehicleIds.juan, {
      from: CAMPUS, to: PLACES.sariayaPlaza, departureTime: nextWeekdayAt('17:30'), totalSeats: 3,
      driverNotes: 'Heading home after my last class. Meet at the main gate.',
    });

    const mariaMatch = await join(api, u.maria.id, juanTrip, { from: PLACES.mariaHome, wantOffset: -5, message: 'Hi Juan! I can walk to the plaza. See you tomorrow.' });
    await api(u.juan.id, 'PATCH', `/api/matches/${mariaMatch.id}`, { status: 'APPROVED' });
    await join(api, u.paolo.id, juanTrip, { from: PLACES.sariayaPlaza, wantOffset: 10, message: 'Pwede po makisabay? I have an 8 AM class.' });
    await join(api, u.rico.id, homeTrip, { from: CAMPUS, message: 'Going to Sariaya too, thanks!' });
    const beaMatch = await join(api, u.bea.id, anaTrip, { from: PLACES.tayabas, wantOffset: -3, message: 'Hi Ate Ana, see you at the basilica!' });
    await api(u.ana.id, 'PATCH', `/api/matches/${beaMatch.id}`, { status: 'APPROVED' });

    const chat = [
      [u.juan.id, 'Good evening Maria! Approved na. I’ll be at the plaza by 6:40.'],
      [u.maria.id, 'Thank you! I’ll be there. Gray jacket and a blue backpack.'],
      [u.juan.id, 'Noted. Silver Vios, plate DMO 1001.'],
      [u.maria.id, 'Got it, see you tomorrow 👍'],
    ];
    for (const [sender, body] of chat) {
      await api(sender, 'POST', `/api/trips/${juanTrip.id}/messages`, { body });
    }

    // One open report for the admin console.
    const ricoPast = await pastRide(api, {
      hostId: u.miguel.id, vehicleId: vehicleIds.miguel, from: PLACES.sariayaEast, daysAgo: 4,
      riders: [{ user: u.rico, from: PLACES.sariayaEast, stars: 3, comment: 'Okay ride.', message: 'Sabay po.' }],
    });
    const ricoMatch = await prisma.match.findFirst({ where: { tripId: ricoPast.id, passengerId: u.rico.id } });
    await api(u.miguel.id, 'POST', '/api/reports', {
      matchId: ricoMatch.id, category: 'INAPPROPRIATE_BEHAVIOR',
      description: 'Arrived 25 minutes late to the pickup point and was rude when I reminded him about the schedule.',
    });

    console.log('Demo data ready. Accounts (password for all: see DEMO_PASSWORD in this file):');
    for (const key of Object.keys(PEOPLE)) console.log(`  ${PEOPLE[key].fullName.padEnd(16)} ${emailFor(key)}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

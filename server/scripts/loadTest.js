// Load test for POST /api/matches/search, closing an audit gap: nothing
// measured response time or demonstrated the manuscript's stated performance
// targets before this script existed.
//
// WHAT IT TESTS AND WHY THESE NUMBERS
// docs/thesis/thesis-proposal.md states the target in three places, and they
// don't agree with each other:
//   - Table III ("Complexity and Performance Targets"): match generation
//     < 2 seconds; concurrent query handling up to 200 simultaneous requests.
//   - "5. Quality Requirements and Evaluation of Results": "load tests
//     simulating 200 concurrent users ... benchmarked against the two-second
//     requirement" — matches Table III's 200.
//   - The separate "Testing Procedure and Evaluation Procedure" section:
//     "Performance testing measures match generation response time at the
//     95th percentile under a simulated load of 50 concurrent users, with a
//     target of under 2 seconds" — a DIFFERENT concurrency figure (50, not
//     200) with an explicit percentile the other two don't state.
// Rather than guess which is the "real" claim, this script runs both
// concurrency levels and reports each against its own source below, so
// whichever the panel asks about is covered.
//
// autocannon's latency histogram doesn't compute an exact p95 (its fixed set
// is p50/p75/p90/p97_5/p99/...) — see node_modules/autocannon/README.md. The
// 50-concurrent scenario's target is evaluated against p97_5 as a slightly
// STRICTER stand-in for the manuscript's p95, labeled as such below rather
// than silently mislabeled as p95.
//
// METHODOLOGY NOTE — why this hits a separately-running server, not an
// in-process one: if the load generator (autocannon) and the Express app
// under test shared the same Node process/event loop, they'd compete for the
// same thread and inflate latency numbers with the load generator's own CPU
// cost, not the app's real response time. Start the real API server first
// (separate OS process, exactly how it runs in dev/prod) and this script
// only drives traffic at it and seeds/cleans data directly via Prisma.
//
// HOW TO RUN
//   1. Start the API server in another terminal:  npm run server
//   2. node server/scripts/loadTest.js
//   Optional: LOAD_TEST_BASE_URL (default http://localhost:4000),
//             LOAD_TEST_KEEP_DATA=1 to skip cleanup (for manual inspection).
//
// LAST REAL RUN — 2026-09-15, against a local `npm run server` (Express) +
// local PostgreSQL 17, seeded with 500 trips as described above. Sanity
// check (single unloaded request): 200 NO_MATCH, 505ms.
//   50 concurrent  (Testing Procedure, p95 spec):
//     p50 = 2081ms  p90 = 2526ms  p97_5(≈p95) = 2802ms  p99 = 2898ms
//     avg req/sec = 23.07  → FAIL vs < 2000ms (fails even at the p50, not
//     just the tail — every percentile including the median missed target)
//   200 concurrent (Table III / Quality Requirements):
//     p50 = 6564ms  p90 = 7594ms  p97_5(≈p95) = 7961ms  p99 = 8052ms
//     avg req/sec = 26.67  → FAIL vs < 2000ms, roughly 4x the target at p50
// Both scenarios fail the manuscript's stated target on this hardware as the
// search path is currently implemented. loadSearchCandidates does an
// unindexed prisma.trip.findMany over ALL open+full trips plus a per-host
// prisma.user.findMany and a prisma.match.findMany for familiarity, then
// runPSGA's for-loop runs a 20-sample route-overlap distance calculation
// against every one of those candidates before any filtering — real O(n)
// work per request, with n = every open trip in the system, not just ones
// plausibly relevant to this searcher. This is a genuine, unmet target, not
// a benchmark artifact — reported as-is per instruction, not tuned to pass.
// Re-run and update this block whenever the search path changes materially.

require('dotenv').config({ quiet: true });
const autocannon = require('autocannon');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');

const BASE = process.env.LOAD_TEST_BASE_URL || 'http://localhost:4000';
const KEEP_DATA = process.env.LOAD_TEST_KEEP_DATA === '1';

// Matches the manuscript's own scale reference for "a realistic pool" — the
// PSGA's algorithm-validation dataset (Section: Algorithm Validation) is 500
// synthetic trips. Also directly exercises Table III's own complexity claim,
// "Time complexity per query O(n) where n = open trips," at that n.
const TRIP_COUNT = 500;
const SEED_BATCH_SIZE = 10; // concurrent creates per batch, kept under the pg pool's default size

const DURATION_SECONDS = 15;
const SCENARIOS = [
  { label: '50 concurrent (Testing Procedure, p95 spec)', connections: 50, targetMs: 2000 },
  { label: '200 concurrent (Table III / Quality Requirements)', connections: 200, targetMs: 2000 },
];

// MSEUF Lucena City campus — src/lib/constants.ts's MSEUF_LUCENA. Every
// seeded trip's destination, matching the manuscript's own commute pattern
// ("every commute in this app converges on" this point).
const CAMPUS = { lat: 13.9490188, lng: 121.6202904 };

function jitter(center, maxDegrees) {
  return center + (Math.random() * 2 - 1) * maxDegrees;
}

// A residential origin somewhere in the ~15km catchment radius the
// manuscript's own synthetic dataset uses around Enverga University.
function randomOrigin() {
  return { lat: jitter(CAMPUS.lat, 0.09), lng: jitter(CAMPUS.lng, 0.09) };
}

async function inBatches(count, batchSize, fn) {
  const results = [];
  for (let start = 0; start < count; start += batchSize) {
    const batchLen = Math.min(batchSize, count - start);
    const batch = await Promise.all(Array.from({ length: batchLen }, (_, i) => fn(start + i)));
    results.push(...batch);
  }
  return results;
}

// DAILY recurrence with a start date far in the past so tripRunsOnSearchDate
// accepts it is true for ANY date this script searches on — every one of the
// 500 seeded trips survives loadSearchCandidates' date filter and reaches
// runPSGA's per-candidate route-overlap scoring, exercising the full O(n)
// pool rather than an easier, artificially-shrunk candidate set.
async function seedHostAndTrip(index) {
  const origin = randomOrigin();
  const user = await prisma.user.create({
    data: {
      fullName: `Load Test Host ${index}`,
      universityId: `LOADTEST-HOST-${index}-${Date.now()}`,
      email: `loadtest-host-${index}-${Date.now()}@test.local`,
      passwordHash: 'x',
      role: 'STUDENT',
      gender: index % 2 === 0 ? 'MALE' : 'FEMALE',
      verified: true,
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: { ownerId: user.id, make: 'Test', model: 'Car', color: 'Blue', fuelEfficiencyKmL: 12 },
  });
  const trip = await prisma.trip.create({
    data: {
      hostId: user.id,
      vehicleId: vehicle.id,
      originAddress: `Load Test Origin ${index}`,
      originLat: origin.lat,
      originLng: origin.lng,
      destinationAddress: 'MSEUF Lucena City',
      destinationLat: CAMPUS.lat,
      destinationLng: CAMPUS.lng,
      departureTime: new Date('2020-01-01T22:00:00Z'), // 6:00 AM PH — start date is irrelevant for DAILY beyond "in the past"
      recurrenceType: 'DAILY',
      customDays: [],
      totalSeats: 3,
      filledSeats: 1,
      genderPreference: 'ANY',
      flexibleDeparture: false,
      flexWindowMinutes: 15,
      familiarRidersOnly: false,
      fuelSharePerSeat: 25,
      status: 'OPEN',
    },
  });
  return { userId: user.id, vehicleId: vehicle.id, tripId: trip.id };
}

async function seed() {
  process.stdout.write(`Seeding ${TRIP_COUNT} trips across ${TRIP_COUNT} hosts`);
  const seeded = await inBatches(TRIP_COUNT, SEED_BATCH_SIZE, async (i) => {
    const row = await seedHostAndTrip(i);
    if (i % 50 === 0) process.stdout.write('.');
    return row;
  });
  console.log(' done.');

  const passenger = await prisma.user.create({
    data: {
      fullName: 'Load Test Passenger',
      universityId: `LOADTEST-PASSENGER-${Date.now()}`,
      email: `loadtest-passenger-${Date.now()}@test.local`,
      passwordHash: 'x',
      role: 'STUDENT',
      gender: 'MALE',
      verified: true,
    },
  });

  return {
    passenger,
    userIds: [...seeded.map((s) => s.userId), passenger.id],
    vehicleIds: seeded.map((s) => s.vehicleId),
    tripIds: seeded.map((s) => s.tripId),
  };
}

async function cleanup(bag) {
  await prisma.match.deleteMany({ where: { tripId: { in: bag.tripIds } } });
  await prisma.trip.deleteMany({ where: { id: { in: bag.tripIds } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: bag.vehicleIds } } });
  await prisma.user.deleteMany({ where: { id: { in: bag.userIds } } });
}

async function assertServerReachable() {
  try {
    const res = await fetch(BASE);
    // Any response (even a 404 for "/") proves the process is up; a thrown
    // fetch error (ECONNREFUSED) means it isn't.
    void res.status;
  } catch (err) {
    console.error(`Could not reach ${BASE} (${err.code || err.message}).`);
    console.error('Start the API server first, in another terminal:  npm run server');
    process.exit(1);
  }
}

// Single labeled request outside the load test, timed client-side — the
// "response-time instrumentation" this script provides. Deliberately not a
// permanent Express middleware: nothing else in the app needs always-on
// per-request timing overhead, and a benchmark script measuring end-to-end
// HTTP latency from the client is simpler and sufficient for this audit item.
async function sanityCheckRequest(token, body) {
  const startedAt = Date.now();
  const res = await fetch(`${BASE}/api/matches/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const elapsedMs = Date.now() - startedAt;
  const json = await res.json();
  const matchCount = json.status === 'MATCHED' ? json.matches.length : 0;
  console.log(
    `Sanity check: single request → ${res.status} ${json.status}, ${matchCount} matches, ${elapsedMs}ms`
  );
  if (res.status !== 200) {
    throw new Error(`Sanity check request failed unexpectedly: ${res.status} ${JSON.stringify(json)}`);
  }
}

async function runScenario(token, body, scenario) {
  console.log(`\n--- ${scenario.label}: ${scenario.connections} connections, ${DURATION_SECONDS}s ---`);
  const result = await autocannon({
    url: `${BASE}/api/matches/search`,
    method: 'POST',
    connections: scenario.connections,
    duration: DURATION_SECONDS,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const { latency, requests, errors, timeouts, non2xx } = result;
  const p95Proxy = latency.p97_5; // see file header — autocannon has no exact p95
  const pass = p95Proxy < scenario.targetMs;

  console.log(`  requests/sec:  avg ${requests.average}`);
  console.log(`  latency (ms):  p50=${latency.p50}  p90=${latency.p90}  p97_5(≈p95)=${p95Proxy}  p99=${latency.p99}  max=${latency.max}`);
  console.log(`  errors=${errors} timeouts=${timeouts} non-2xx=${non2xx}`);
  console.log(`  target: p95-proxy < ${scenario.targetMs}ms → ${pass ? 'PASS' : 'FAIL'}`);

  return { scenario, latency, requests, errors, timeouts, non2xx, pass };
}

async function main() {
  await assertServerReachable();

  const bag = await seed();
  const token = bearer(bag.passenger.id).Authorization.replace('Bearer ', '');
  const searchBody = {
    origin: randomOrigin(),
    destination: CAMPUS,
    departureMinutes: 420, // 7:00 AM — the manuscript's own stated peak commute time
    flexWindowMinutes: 60,
    genderPreference: 'ANY',
    date: '2026-09-15',
  };

  try {
    await sanityCheckRequest(token, searchBody);

    const results = [];
    for (const scenario of SCENARIOS) {
      results.push(await runScenario(token, searchBody, scenario));
    }

    console.log('\n=== Summary ===');
    for (const r of results) {
      console.log(`${r.scenario.label}: ${r.pass ? 'PASS' : 'FAIL'} (p97_5≈p95 = ${r.latency.p97_5}ms, target < ${r.scenario.targetMs}ms)`);
    }
  } finally {
    if (KEEP_DATA) {
      console.log('\nLOAD_TEST_KEEP_DATA=1 set — leaving seeded data in place.');
    } else {
      console.log('\nCleaning up seeded data...');
      await cleanup(bag);
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

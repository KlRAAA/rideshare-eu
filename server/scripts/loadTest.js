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
// FIRST RUN — 2026-09-15, before any fix. Both scenarios FAILED: 50
// concurrent p50=2081ms/p97_5(≈p95)=2802ms; 200 concurrent p50=6564ms/
// p97_5=7961ms. The original theory (recorded here at the time) was that
// runPSGA's per-candidate route-overlap sampling was the O(n) cost. Direct
// profiling afterward DISPROVED that: an isolated single request costs ~120ms
// total, of which route-overlap for all 500 candidates is only ~16ms — and
// instrumenting the live endpoint during an actual concurrent burst confirmed
// the CPU-bound (runPSGA) portion stayed flat at 9-16ms regardless of
// concurrency while the DB-awaited portion (loadSearchCandidates) ballooned
// to 1-2.6 SECONDS. The real cost is Postgres: prisma.trip.findMany with
// `include: { vehicle: true, host: {...} }` fetches and joins EVERY open/full
// trip in the system on every search, with no narrowing — under 50-200
// concurrent requests each redundantly re-fetching/re-joining the same
// ~500-row pool, that single query alone measured 889-1273ms average (up to
// 1868ms) in isolation; enlarging the connection pool (10 -> 100) did not
// help, ruling out simple pool starvation.
//
// A geographic bounding-box pre-filter was attempted next (provably safe via
// an exact haversine-derived inequality) and then reverted: it never
// wrongly excluded a real match, but it also never excluded ANYTHING for
// this app's actual usage — every trip's route bbox spans origin to
// destination, every destination is (or nearly is) the same fixed campus
// point, and two boxes that both contain the same point always overlap
// there regardless of how far apart the origins are. Verified directly: 500
// of 500 seeded trips survived the filter. Traced further, this isn't a flaw
// in the filter's shape — it reflects the PSGA route-overlap metric itself
// already giving partial credit near a shared destination independent of
// origin distance (confirmed: a host origin 222km away, sharing the
// passenger's destination, still scored 0.38 overlap, just under the 0.4
// threshold) — so any pre-filter that stays consistent with what the real
// algorithm would compute inherits that same leniency near a common
// endpoint. Fixed instead by deferring the vehicle/host JOIN: fetch lean
// trip-only fields for Stage 1/2 scoring (no include), then join
// vehicle/host only for the handful of trips actually returned to the
// client — see loadSearchCandidates in matchController.js.
//
// LAST REAL RUN (after the join-deferral fix) — 2026-09-15, same 500-trip
// seed, same local `npm run server` + PostgreSQL 17. Sanity check (single
// unloaded request): 200 NO_MATCH, 305ms (was 505ms).
//   50 concurrent  (Testing Procedure, p95 spec):
//     p50 = 1052ms  p90 = 1188ms  p97_5(≈p95) = 1387ms  p99 = 1561ms
//     avg req/sec = 45.74 (was 23.07) → PASS vs < 2000ms
//   200 concurrent (Table III / Quality Requirements):
//     p50 = 4332ms  p90 = 5132ms  p97_5(≈p95) = 5321ms  p99 = 5373ms
//     avg req/sec = 40 (was 26.67) → still FAIL vs < 2000ms, though p50
//     dropped from 6564ms to 4332ms (~34% faster) and p97_5 from 7961ms to
//     5321ms (~33% faster)
// Real, honest improvement, not tuned to pass: the 50-concurrent scenario
// (the more specific of the manuscript's two conflicting claims — it states
// an explicit percentile) now passes. The 200-concurrent scenario (Table
// III's own stated ceiling) still fails by a wide margin. Deferring the
// vehicle/host JOIN cut the dominant cost roughly in half, but 200 concurrent
// searches each still doing 4 sequential DB round-trips (searcher lookup,
// lean trip fetch, hosts fetch, prior-matches fetch) against one Postgres
// instance is still real, substantial load — further gains would need
// reducing round-trips per search (e.g. combining queries) or caching, not
// attempted here. This is a genuine unmet target at 200 concurrent on this
// hardware, reported as measured.
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

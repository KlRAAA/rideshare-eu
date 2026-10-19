// Local load test (sub-project J). Starts the API in production mode against
// the rideshare_load database, then simulates people using the app with its
// real timings, stepping up the number of simultaneous users. Run seed.cjs first.
//
//   node loadtest/run.cjs            # stages 50,100,200,300,400,500, 60 s each
//   STAGES=50,100 STAGE_SECONDS=30 node loadtest/run.cjs
//
// Who does what (the app's own intervals):
//   everyone      alerts feed every 10 s (5 s before 19 Oct; FEED_SECONDS=5 to
//                 repeat the first run); a page view (me, My Trips, Alerts) every 60 s
//   browsers      half of them also search for a ride every 2 min
//   live riders   driver's position every 10 s, chat every 7 s, trip page every 60 s
//   live drivers  send position + ETA every 10 s, riders' locations every 30 s,
//                 chat every 7 s, a chat message every 2 min
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { bearer } = require('../server/test-helpers/auth');

const PORT = 4200;
const BASE = `http://127.0.0.1:${PORT}`;
const DB = 'postgres://postgres:postgres@localhost:5432/rideshare_load';
const ORIGIN_SECRET = crypto.randomBytes(24).toString('hex');
const STAGES = (process.env.STAGES || '50,100,200,300,400,500').split(',').map(Number);
const STAGE_SECONDS = Number(process.env.STAGE_SECONDS || 60);
const WARMUP_SECONDS = 10; // after each step up, before measuring
const FEED_MS = Number(process.env.FEED_SECONDS || 10) * 1000;
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'));

// ---- the API under test ---------------------------------------------------
function startApi() {
  const api = spawn(process.execPath, ['server/server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      DATABASE_URL: DB,
      ORIGIN_SECRET,
      CORS_ORIGIN: 'https://loadtest.invalid',
      BREVO_API_KEY: 'loadtest-not-used',
      EMAIL_FROM: 'loadtest@test.invalid',
      LICENSE_OCR: 'off',
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
      VAPID_SUBJECT: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errors = 0;
  api.stderr.on('data', (d) => {
    const text = String(d);
    if (!text.includes('"type":"security"')) errors += text.split('\n').filter(Boolean).length;
  });
  api.stdout.on('data', () => {});
  return { api, errorLines: () => errors };
}

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API did not start');
}

// CPU % (of the whole machine) and memory of the API process. Postgres runs
// as a Windows service, whose CPU time can't be read without admin rights.
function sampleProcesses(apiPid) {
  const script = `$a=Get-Process -Id ${apiPid}; "$($a.TotalProcessorTime.TotalMilliseconds) $($a.WorkingSet64)"`;
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-Command', script], (err, out) => {
      if (err) return resolve(null);
      const [apiCpu, apiMem] = out.trim().split(' ');
      resolve({ at: Date.now(), apiCpuMs: Number(apiCpu), apiMem: Number(apiMem) });
    });
  });
}

// ---- recording --------------------------------------------------------------
let stage = null;
const records = []; // { stage, name, ms, ok, busy }
const request = async (name, userId, method, url, body) => {
  const started = performance.now();
  let ok = false;
  let busy = false;
  try {
    const r = await fetch(BASE + url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-origin-secret': ORIGIN_SECRET, ...bearer(userId) },
      body: body ? JSON.stringify(body) : undefined,
      // A phone gives up on a request that hangs; counted as an error.
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json().catch(() => null);
    ok = r.ok;
    busy = r.status === 503; // answered "busy, try again" at once
    return data;
  } catch {
    return null;
  } finally {
    if (stage?.measuring) records.push({ stage: stage.users, name, ms: performance.now() - started, ok, busy });
  }
};

// ---- simulated people -------------------------------------------------------
const timers = [];
const every = (ms, fn) => {
  const first = setTimeout(() => {
    fn();
    timers.push(setInterval(fn, ms));
  }, Math.random() * ms); // spread out, like real phones
  timers.push(first);
};
const phToday = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

function person(userId, mode) {
  let cursor = '';
  every(FEED_MS, async () => {
    const data = await request('alerts feed', userId, 'GET', `/api/alerts/feed?mode=${mode}${cursor ? `&after=${encodeURIComponent(cursor)}` : ''}`);
    if (data?.cursor) cursor = data.cursor;
  });
  every(60000, () => {
    request('page: me', userId, 'GET', `/api/users/${userId}`);
    request('page: my trips', userId, 'GET', '/api/trips/mine');
    request('page: alerts', userId, 'GET', `/api/alerts?mode=${mode}`);
  });
}

function browser(userId, searches) {
  person(userId, 'passenger');
  if (!searches) return;
  every(120000, () => {
    const town = fixture.towns[Math.floor(Math.random() * fixture.towns.length)];
    const jitter = () => (Math.random() - 0.5) * 0.01;
    const inAnHour = new Date(Date.now() + 60 * 60000);
    request('search', userId, 'POST', '/api/matches/search', {
      origin: { lat: town.lat + jitter(), lng: town.lng + jitter() },
      destination: fixture.campus,
      departureMinutes: inAnHour.getUTCHours() * 60 + inAnHour.getUTCMinutes(),
      date: phToday(),
      flexWindowMinutes: 30,
      genderPreference: 'ANY',
    });
  });
}

function liveRider(userId, tripId) {
  person(userId, 'passenger');
  every(10000, () => request('driver position', userId, 'GET', `/api/trips/${tripId}/location`));
  every(7000, () => request('chat poll', userId, 'GET', `/api/trips/${tripId}/messages`));
  every(60000, () => request('page: trip', userId, 'GET', `/api/trips/${tripId}`));
}

function liveDriver(trip) {
  person(trip.driverId, 'driver');
  let step = 0;
  every(10000, () => {
    step += 1;
    const t = Math.min(1, step / 100);
    request('send position', trip.driverId, 'POST', `/api/trips/${trip.tripId}/location`, {
      lat: trip.origin.lat + (fixture.campus.lat - trip.origin.lat) * t,
      lng: trip.origin.lng + (fixture.campus.lng - trip.origin.lng) * t,
      etaSeconds: 1200,
    });
  });
  every(30000, () => request('riders nearby', trip.driverId, 'GET', `/api/trips/${trip.tripId}/rider-locations`));
  every(7000, () => request('chat poll', trip.driverId, 'GET', `/api/trips/${trip.tripId}/messages`));
  every(120000, () => request('send chat', trip.driverId, 'POST', `/api/trips/${trip.tripId}/messages`, { body: 'On my way' }));
}

// The mix at every size: 8% drivers on the road, 24% riders on those trips,
// 4% drivers between trips, the rest browsing (half of them searching).
const started = { drivers: 0, riders: 0, idle: 0, browsers: 0 };
const liveRiders = fixture.live.flatMap((t) => t.riderIds.map((r) => ({ userId: r, tripId: t.tripId })));
function growTo(users) {
  const want = {
    drivers: Math.min(fixture.live.length, Math.round(users * 0.08)),
    riders: Math.min(liveRiders.length, Math.round(users * 0.24)),
    idle: Math.min(fixture.idleDrivers.length, Math.round(users * 0.04)),
  };
  want.browsers = Math.min(fixture.browsers.length, users - want.drivers - want.riders - want.idle);
  for (; started.drivers < want.drivers; started.drivers++) liveDriver(fixture.live[started.drivers]);
  for (; started.riders < want.riders; started.riders++) liveRider(liveRiders[started.riders].userId, liveRiders[started.riders].tripId);
  for (; started.idle < want.idle; started.idle++) person(fixture.idleDrivers[started.idle], 'driver');
  for (; started.browsers < want.browsers; started.browsers++) browser(fixture.browsers[started.browsers], started.browsers % 2 === 0);
  return started.drivers + started.riders + started.idle + started.browsers;
}

// ---- results ------------------------------------------------------------------
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);
// Times are for requests that were served; "busy" answers are counted apart.
function summarise(rows, seconds) {
  const ms = rows.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
  const busy = rows.filter((r) => r.busy).length;
  const errors = rows.filter((r) => !r.ok && !r.busy).length;
  return {
    requests: rows.length,
    perSecond: +(rows.length / seconds).toFixed(1),
    servedPerSecond: +(ms.length / seconds).toFixed(1),
    busyRate: rows.length ? +((busy / rows.length) * 100).toFixed(2) : 0,
    p50: Math.round(pct(ms, 50)),
    p95: Math.round(pct(ms, 95)),
    p99: Math.round(pct(ms, 99)),
    max: Math.round(ms[ms.length - 1] || 0),
    errorRate: rows.length ? +((errors / rows.length) * 100).toFixed(2) : 0,
  };
}

(async () => {
  const { api, errorLines } = startApi();
  await waitForHealth();
  console.log(`API up (pid ${api.pid}). Stages: ${STAGES.join(', ')} users, ${STAGE_SECONDS} s each.\n`);
  const cores = require('os').cpus().length;
  const results = [];

  for (const users of STAGES) {
    const actual = growTo(users);
    stage = { users: actual, measuring: false };
    await new Promise((r) => setTimeout(r, WARMUP_SECONDS * 1000));
    const before = await sampleProcesses(api.pid);
    const errorsBefore = errorLines();
    stage.measuring = true;
    await new Promise((r) => setTimeout(r, STAGE_SECONDS * 1000));
    stage.measuring = false;
    const after = await sampleProcesses(api.pid);
    const wall = after && before ? after.at - before.at : STAGE_SECONDS * 1000;

    const rows = records.filter((r) => r.stage === actual);
    const byName = {};
    for (const r of rows) (byName[r.name] ||= []).push(r);
    const result = {
      users: actual,
      overall: summarise(rows, STAGE_SECONDS),
      endpoints: Object.fromEntries(Object.entries(byName).map(([n, rs]) => [n, summarise(rs, STAGE_SECONDS)])),
      apiCpuPercent: before && after ? +(((after.apiCpuMs - before.apiCpuMs) / wall / cores) * 100).toFixed(1) : null,
      apiMemoryMB: after ? Math.round(after.apiMem / 1048576) : null,
      apiErrorLogLines: errorLines() - errorsBefore,
    };
    results.push(result);
    const o = result.overall;
    console.log(
      `${String(actual).padStart(4)} users | ${String(o.perSecond).padStart(6)} req/s (${o.servedPerSecond} served) | busy ${o.busyRate}% | p50 ${o.p50} ms | p95 ${o.p95} ms | p99 ${o.p99} ms | max ${o.max} ms | errors ${o.errorRate}% | API CPU ${result.apiCpuPercent}% | API ${result.apiMemoryMB} MB`
    );
  }

  timers.forEach((t) => clearTimeout(t));
  timers.forEach((t) => clearInterval(t));
  api.kill();
  const dir = path.join(__dirname, 'results');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ machine: { cpu: require('os').cpus()[0].model, cores, memoryGB: Math.round(require('os').totalmem() / 1073741824) }, stageSeconds: STAGE_SECONDS, results }, null, 2)
  );
  console.log(`\nSaved ${path.relative(process.cwd(), file)}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

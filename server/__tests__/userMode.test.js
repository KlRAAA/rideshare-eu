require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, cleanup } = require('../test-helpers/seed');

// Driver and Passenger mode live on the account (sub-project C).

let server;
let base;
let dbUp = false;
const bag = newBag();
const req = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? bearer(userId) : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

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
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});
const guard = () => !dbUp;

test('a new account is a passenger; switching to driver sticks; bad values are refused', async () => {
  if (guard()) return;
  const me = await makeUser(bag, { fullName: 'Mode User' });
  expect((await (await req('GET', `/api/users/${me.id}`, me.id)).json()).user.activeMode).toBe('PASSENGER');

  const res = await req('PATCH', '/api/users/me/mode', me.id, { mode: 'DRIVER' });
  expect(res.status).toBe(200);
  expect((await res.json()).activeMode).toBe('DRIVER');
  expect((await (await req('GET', `/api/users/${me.id}`, me.id)).json()).user.activeMode).toBe('DRIVER');

  const bad = await req('PATCH', '/api/users/me/mode', me.id, { mode: 'PILOT' });
  expect(bad.status).toBe(400);
  expect((await bad.json()).error).toBe('INVALID_MODE');
});

test("someone else's record never shows their mode", async () => {
  if (guard()) return;
  const a = await makeUser(bag, { fullName: 'Mode A' });
  const b = await makeUser(bag, { fullName: 'Mode B' });
  expect((await (await req('GET', `/api/users/${a.id}`, b.id)).json()).user.activeMode).toBeUndefined();
});

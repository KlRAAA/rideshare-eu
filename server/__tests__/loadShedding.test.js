const { createShedder } = require('../middleware/loadShedding');

// Past the limit the API answers "busy" at once instead of queueing requests
// it can't finish (the load test collapsed at 600 users without this).

function fakeRes() {
  const handlers = {};
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    on(event, fn) { handlers[event] = fn; },
    finish() { handlers.finish?.(); },
  };
}

test('requests over the limit get 503 SERVER_BUSY with Retry-After; finished ones free a slot', () => {
  const shed = createShedder(2);
  const passed = [];
  const reqs = [0, 1, 2].map(() => ({ path: '/api/trips/mine' }));
  const ress = reqs.map(() => fakeRes());
  reqs.forEach((req, i) => shed(req, ress[i], () => passed.push(i)));

  expect(passed).toEqual([0, 1]);
  expect(ress[2].statusCode).toBe(503);
  expect(ress[2].body).toMatchObject({ error: 'SERVER_BUSY' });
  expect(ress[2].headers['Retry-After']).toBe('5');

  ress[0].finish();
  const next = fakeRes();
  shed({ path: '/api/trips/mine' }, next, () => passed.push('next'));
  expect(passed).toContain('next');
});

test('the health check is never refused', () => {
  const shed = createShedder(0);
  let ran = false;
  shed({ path: '/api/health' }, fakeRes(), () => { ran = true; });
  expect(ran).toBe(true);
});

const app = require('../app');
const { checkBody } = require('../middleware/strictBody');
const { SCHEMAS, NEVER_SET } = require('../validation/bodySchemas');

// Every POST/PUT/PATCH/DELETE route, with the body schema it uses (or null).
function writeRoutes(stack = app.router.stack, prefix = '') {
  const routes = [];
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).filter((m) => ['post', 'put', 'patch', 'delete'].includes(m));
      const schema = layer.route.stack.map((l) => l.handle.bodySchema).find(Boolean) ?? null;
      for (const method of methods) routes.push({ route: `${method.toUpperCase()} ${prefix}${layer.route.path}`, schema });
    } else if (layer.handle?.stack) {
      routes.push(...writeRoutes(layer.handle.stack, `${prefix}…`));
    }
  }
  return routes;
}

describe('every write route has a strict body schema', () => {
  const routes = writeRoutes();

  test('the app has write routes to check', () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  test.each(routes)('$route uses a schema', ({ schema }) => {
    expect(schema).not.toBeNull();
    expect(SCHEMAS[schema]).toBeDefined();
  });

  test('no schema lists a field that must never be set', () => {
    const offenders = [];
    const walk = (schema, name) => {
      for (const [key, spec] of Object.entries(schema)) {
        if (NEVER_SET.has(key)) offenders.push(`${name}.${key}`);
        if (typeof spec === 'object') walk(spec, `${name}.${key}`);
      }
    };
    for (const [name, schema] of Object.entries(SCHEMAS)) walk(schema, name);
    expect(offenders).toEqual([]);
  });
});

describe('checkBody', () => {
  const schema = { name: 'string', seats: 'numeric', count: 'number', ok: 'boolean', tags: 'array', car: { plate: 'string' } };

  test('accepts listed fields of the right type, and null for any of them', () => {
    expect(checkBody({ name: 'A', seats: '3', count: 2, ok: true, tags: [], car: { plate: 'X' } }, schema)).toBeNull();
    expect(checkBody({ name: null, car: null }, schema)).toBeNull();
    expect(checkBody({}, schema)).toBeNull();
  });

  test.each([
    [{ userId: 'u1' }, { error: 'FORBIDDEN_FIELD', field: 'userId' }],
    [{ isAdmin: true }, { error: 'FORBIDDEN_FIELD', field: 'isAdmin' }],
    [{ car: { ownerId: 'u1' } }, { error: 'FORBIDDEN_FIELD', field: 'car.ownerId' }],
    [{ status: 'COMPLETED' }, { error: 'UNKNOWN_FIELD', field: 'status' }],
    [{ car: { vin: '1' } }, { error: 'UNKNOWN_FIELD', field: 'car.vin' }],
    [{ name: 5 }, { error: 'INVALID_FIELD_TYPE', field: 'name' }],
    [{ seats: 'three' }, { error: 'INVALID_FIELD_TYPE', field: 'seats' }],
    [{ count: '2' }, { error: 'INVALID_FIELD_TYPE', field: 'count' }],
    [{ count: Number.NaN }, { error: 'INVALID_FIELD_TYPE', field: 'count' }],
    [{ ok: 'yes' }, { error: 'INVALID_FIELD_TYPE', field: 'ok' }],
    [{ tags: {} }, { error: 'INVALID_FIELD_TYPE', field: 'tags' }],
    [{ car: 'plate' }, { error: 'INVALID_BODY', field: 'car' }],
    [[], { error: 'INVALID_BODY', field: null }],
  ])('%p → %p', (body, expected) => {
    expect(checkBody(body, schema)).toEqual(expected);
  });
});

const { logSecurityEvent, setSecurityLogSink, maskEmail } = require('../securityLog');

const fakeReq = (overrides = {}) => ({
  ip: '203.0.113.7',
  originalUrl: '/api/auth/verify',
  get: (name) => (name.toLowerCase() === 'user-agent' ? 'Mozilla/5.0 (test)' : undefined),
  ...overrides,
});

let captured;
let restore;

beforeEach(() => {
  captured = [];
  restore = setSecurityLogSink((entry) => captured.push(entry));
});

afterEach(() => setSecurityLogSink(restore));

describe('maskEmail', () => {
  test('keeps the first character and the domain', () => {
    expect(maskEmail('juan.delacruz@student.mseuf.edu.ph')).toBe('j***@student.mseuf.edu.ph');
  });

  test('returns null for anything that is not an email', () => {
    expect(maskEmail(undefined)).toBeNull();
    expect(maskEmail('')).toBeNull();
    expect(maskEmail('no-at-sign')).toBeNull();
    expect(maskEmail({ email: 'x@y.z' })).toBeNull();
  });
});

describe('logSecurityEvent', () => {
  test('writes one entry with the event, request context and a masked email', () => {
    logSecurityEvent(fakeReq(), 'LOGIN_FAILED', { email: 'maria@student.mseuf.edu.ph', reason: 'WRONG_PASSWORD', userId: 'u1' });

    expect(captured).toHaveLength(1);
    const [entry] = captured;
    expect(entry).toMatchObject({
      type: 'security',
      event: 'LOGIN_FAILED',
      ip: '203.0.113.7',
      route: '/api/auth/verify',
      userAgent: 'Mozilla/5.0 (test)',
      email: 'm***@student.mseuf.edu.ph',
      reason: 'WRONG_PASSWORD',
      userId: 'u1',
    });
    expect(new Date(entry.at).toString()).not.toBe('Invalid Date');
  });

  test('drops any detail outside the allowed fields, so a password or code can never be logged', () => {
    logSecurityEvent(fakeReq(), 'OTP_FAILED', { email: 'a@b.co', attempts: 2, password: 'hunter22', otp: '123456', token: 'abc' });

    const serialized = JSON.stringify(captured[0]);
    expect(serialized).not.toContain('hunter22');
    expect(serialized).not.toContain('123456');
    expect(captured[0]).not.toHaveProperty('password');
    expect(captured[0]).not.toHaveProperty('otp');
    expect(captured[0]).not.toHaveProperty('token');
    expect(captured[0].attempts).toBe(2);
  });

  test('strips the query string from the route', () => {
    logSecurityEvent(fakeReq({ originalUrl: '/api/auth/verify?email=someone@x.y' }), 'RATE_LIMITED');
    expect(captured[0].route).toBe('/api/auth/verify');
  });

  test('caps a very long user agent', () => {
    const longAgent = 'A'.repeat(1000);
    logSecurityEvent(fakeReq({ get: () => longAgent }), 'RATE_LIMITED');
    expect(captured[0].userAgent.length).toBeLessThanOrEqual(200);
  });

  test('rejects an unknown event name instead of logging it', () => {
    expect(() => logSecurityEvent(fakeReq(), 'SOMETHING_ELSE')).toThrow(/Unknown security event/);
    expect(captured).toHaveLength(0);
  });

  test('a failing sink never breaks the request that triggered it', () => {
    setSecurityLogSink(() => {
      throw new Error('disk full');
    });
    expect(() => logSecurityEvent(fakeReq(), 'LOGIN_FAILED')).not.toThrow();
  });
});

describe('logAccessDenied middleware', () => {
  const { logAccessDenied } = require('../../middleware/logAccessDenied');

  function run(status, body) {
    const req = { ...fakeReq({ originalUrl: '/api/matches/m1', method: 'PATCH' }), user: { id: 'u9' } };
    const sent = [];
    const res = { statusCode: 200, json(payload) { sent.push(payload); return this; } };
    logAccessDenied(req, res, () => {});
    res.statusCode = status;
    res.json(body);
    return sent;
  }

  test('logs an ownership 403 and still sends the original body', () => {
    const sent = run(403, { error: 'NOT_AUTHORIZED' });
    expect(sent).toEqual([{ error: 'NOT_AUTHORIZED' }]);
    expect(captured).toEqual([expect.objectContaining({ event: 'ACCESS_DENIED', reason: 'NOT_AUTHORIZED', userId: 'u9', method: 'PATCH' })]);
  });

  test.each([
    [403, { error: 'ACCOUNT_SUSPENDED' }],
    [403, { error: 'LOCATION_SHARING_DISABLED' }],
    [404, { error: 'NOT_FOUND' }],
    [200, { ok: true }],
  ])('ignores %s %j', (status, body) => {
    run(status, body);
    expect(captured).toEqual([]);
  });
});

describe('extra sinks', () => {
  const { addSecurityLogSink } = require('../securityLog');

  test('every extra sink receives the entry, and removing one stops it', () => {
    const extra = [];
    const remove = addSecurityLogSink((entry) => extra.push(entry));
    logSecurityEvent(fakeReq(), 'RATE_LIMITED', { limit: 10 });
    expect(extra).toEqual([expect.objectContaining({ event: 'RATE_LIMITED', limit: 10 })]);
    expect(captured).toHaveLength(1);

    remove();
    logSecurityEvent(fakeReq(), 'RATE_LIMITED');
    expect(extra).toHaveLength(1);
  });

  test('a failing extra sink never breaks the request or the main sink', () => {
    const remove = addSecurityLogSink(() => {
      throw new Error('db down');
    });
    expect(() => logSecurityEvent(fakeReq(), 'LOGIN_FAILED')).not.toThrow();
    expect(captured).toHaveLength(1);
    remove();
  });
});

const { requireOriginSecret } = require('../middleware/requireOriginSecret');

const SECRET = 's'.repeat(64);

// Runs the middleware on a fake request whose own address is the website's
// server (what Railway sees), and reports what happened.
function run(headers, secret = SECRET) {
  const req = Object.create({ get ip() { return '13.212.8.174'; } });
  req.headers = headers;
  let status = null;
  let passed = false;
  const res = { status(code) { status = code; return { json() {} }; } };
  requireOriginSecret(secret)(req, res, () => { passed = true; });
  return { passed, status, ip: req.ip };
}

describe('requireOriginSecret', () => {
  test('refuses a request without the secret', () => {
    expect(run({ 'x-client-ip': '180.190.133.229' })).toMatchObject({ passed: false, status: 403 });
  });

  test("uses the visitor's address the website forwards with the secret", () => {
    const result = run({ 'x-origin-secret': SECRET, 'x-client-ip': '180.190.133.229' });
    expect(result).toMatchObject({ passed: true, ip: '180.190.133.229' });
  });

  test('accepts IPv6 visitor addresses', () => {
    expect(run({ 'x-origin-secret': SECRET, 'x-client-ip': '2001:db8::1' }).ip).toBe('2001:db8::1');
  });

  test('ignores a forwarded address that is not an IP', () => {
    expect(run({ 'x-origin-secret': SECRET, 'x-client-ip': 'evil, 1.2.3.4' }).ip).toBe('13.212.8.174');
  });

  test('keeps the connecting address when the website sends none (server rendering)', () => {
    expect(run({ 'x-origin-secret': SECRET }).ip).toBe('13.212.8.174');
  });

  test('never trusts the header when no secret is configured (local development)', () => {
    const result = run({ 'x-client-ip': '1.2.3.4' }, '');
    expect(result).toMatchObject({ passed: true, ip: '13.212.8.174' });
  });
});

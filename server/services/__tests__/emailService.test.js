jest.mock('nodemailer', () => {
  const sendMail = jest.fn().mockResolvedValue({});
  return { createTransport: jest.fn(() => ({ sendMail })), __sendMail: sendMail };
});

const nodemailer = require('nodemailer');
const { sendOtpEmail, sendBanNotificationEmail, isUndeliverableAddress } = require('../emailService');

const ORIGINAL_SMTP_HOST = process.env.SMTP_HOST;

beforeAll(() => {
  process.env.SMTP_HOST = 'smtp.example.test';
});

afterAll(() => {
  if (ORIGINAL_SMTP_HOST === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = ORIGINAL_SMTP_HOST;
});

beforeEach(() => nodemailer.__sendMail.mockClear());

const BAN = { categoryLabel: 'Spam', permanent: false, bannedUntil: new Date('2026-10-07T00:00:00Z') };

describe('isUndeliverableAddress', () => {
  test.each([
    ['a@test.local', true],
    ['a@b.test', true],
    ['a@x.invalid', true],
    ['a@example.com', true],
    ['a@x.localhost', true],
    ['A00-00000@student.mseuf.edu.ph', false],
    ['someone@gmail.com', false],
  ])('%s → %p', (email, expected) => {
    expect(isUndeliverableAddress(email)).toBe(expected);
  });
});

describe('delivery', () => {
  test('never hands a reserved test-domain address to SMTP', async () => {
    await sendOtpEmail('postman-host@test.local', '123456');
    await sendBanNotificationEmail('postman-passenger@test.local', BAN);
    expect(nodemailer.__sendMail).not.toHaveBeenCalled();
  });

  test('still sends to a real address', async () => {
    await sendOtpEmail('A00-00000@student.mseuf.edu.ph', '123456');
    expect(nodemailer.__sendMail).toHaveBeenCalledTimes(1);
  });
});

describe('ban notification wording', () => {
  test('an automatic ban says no person reviewed it', async () => {
    await sendBanNotificationEmail('someone@gmail.com', BAN);
    const { text } = nodemailer.__sendMail.mock.calls[0][0];
    expect(text).toContain('automatically suspended');
    expect(text).toContain('not reviewed by a person');
  });

  test('an admin ban says an administrator decided it', async () => {
    await sendBanNotificationEmail('someone@gmail.com', { ...BAN, byAdmin: true });
    const { text } = nodemailer.__sendMail.mock.calls[0][0];
    expect(text).toContain('suspended by a RideShareEU administrator');
    expect(text).not.toContain('not reviewed by a person');
  });
});

describe('HTTPS email APIs (Railway Hobby blocks SMTP)', () => {
  const { parseFrom } = require('../emailService');
  const saved = {};
  const KEYS = ['RESEND_API_KEY', 'BREVO_API_KEY', 'EMAIL_FROM'];
  let fetchSpy;

  beforeEach(() => {
    for (const k of KEYS) saved[k] = process.env[k];
    process.env.EMAIL_FROM = 'RideShareEU <no-reply@rideshare.example>';
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, text: async () => '' });
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    fetchSpy.mockRestore();
  });

  test('with RESEND_API_KEY the code goes through Resend, not SMTP', async () => {
    process.env.RESEND_API_KEY = 're_test';
    await sendOtpEmail('A00-00000@student.mseuf.edu.ph', '123456');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body)).toEqual({
      from: 'RideShareEU <no-reply@rideshare.example>',
      to: ['A00-00000@student.mseuf.edu.ph'],
      subject: 'Your RideShareEU verification code',
      text: 'Your verification code is 123456. It expires in 10 minutes.',
    });
    expect(nodemailer.__sendMail).not.toHaveBeenCalled();
  });

  test('with BREVO_API_KEY it goes through Brevo with the sender split into name and address', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.BREVO_API_KEY = 'xkeysib-test';
    await sendOtpEmail('A00-00000@student.mseuf.edu.ph', '654321');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('xkeysib-test');
    expect(JSON.parse(init.body)).toMatchObject({
      sender: { name: 'RideShareEU', email: 'no-reply@rideshare.example' },
      to: [{ email: 'A00-00000@student.mseuf.edu.ph' }],
      textContent: 'Your verification code is 654321. It expires in 10 minutes.',
    });
  });

  test('a refused send is an error, so the caller does not report "code sent"', async () => {
    process.env.RESEND_API_KEY = 're_test';
    fetchSpy.mockResolvedValue({ ok: false, status: 403, text: async () => 'domain not verified' });
    await expect(sendOtpEmail('A00-00000@student.mseuf.edu.ph', '123456')).rejects.toThrow(/Resend refused the email \(403\)/);
  });

  test('test-domain addresses are still never sent anywhere', async () => {
    process.env.RESEND_API_KEY = 're_test';
    await sendOtpEmail('postman-host@test.local', '123456');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('parseFrom', () => {
    expect(parseFrom('RideShareEU <no-reply@x.ph>')).toEqual({ name: 'RideShareEU', email: 'no-reply@x.ph' });
    expect(parseFrom('no-reply@x.ph')).toEqual({ email: 'no-reply@x.ph' });
  });
});
